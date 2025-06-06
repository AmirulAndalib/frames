import { accessibleBy } from '@casl/prisma';
import {
    WillAuthorize,
    Authorizer,
    RuleBuilder,
    Action,
    AppAbilityType,
    Permission,
    AuthorizationContext
} from '@eleven-am/authorizer';
import { TaskEither, createNotFoundError } from '@eleven-am/fp';
import { User, Role, AccessPolicy } from '@prisma/client';
import { MediaAuthorizer } from '../media/media.authorizer';
import { PrismaService } from '../prisma/prisma.service';

import { GRACE_PERIOD } from './downloads.constants';


@Authorizer()
export class DownloadsAuthorizer implements WillAuthorize {
    constructor (private readonly prismaService: PrismaService) {}

    forUser (user: User, { can, cannot }: RuleBuilder) {
        if (user.role === Role.GUEST || user.revoked || !user.confirmedEmail) {
            cannot(Action.Manage, 'Download').because('User is not authorised to access the Download resource');

            return;
        }

        can(Action.Read, 'Download', {
            AND: [
                {
                    userId: user.id,
                },
                {
                    view: {
                        video: {
                            media: MediaAuthorizer.getQuery(user, AccessPolicy.READ),
                        },
                    },
                },
            ],
        });

        can(Action.Create, 'Download', {
            view: {
                video: {
                    media: MediaAuthorizer.getQuery(user, AccessPolicy.READ),
                },
                userId: user.id,
            },
        });

        can(Action.Update, 'Download', {
            AND: [
                {
                    userId: user.id,
                },
                {
                    view: {
                        video: {
                            media: MediaAuthorizer.getQuery(user, AccessPolicy.READ),
                        },
                    },
                },
            ],
        });
    }

    authorize (context: AuthorizationContext, ability: AppAbilityType, _rules: Permission[]) {
        if (context.isSocket) {
            return TaskEither.of(true);
        }

        const request = context.getRequest();
        const downloadId = request.params.downloadId;

        if (downloadId === undefined) {
            return TaskEither.of(true);
        }

        const now = new Date();

        return TaskEither
            .tryCatch(
                () => this.prismaService.download.findFirst({
                    where: {
                        AND: [
                            { location: downloadId },
                            accessibleBy(ability, Action.Read).Download,
                        ],
                    },
                }),
                'Failed to retrieve download',
            )
            .nonNullable('Download not found')
            .filter(
                (download) => (now.getTime() - download.created.getTime()) < GRACE_PERIOD,
                () => createNotFoundError('Download not found'),
            )
            .map((download) => {
                request.download = download;

                return true;
            });
    }
}
