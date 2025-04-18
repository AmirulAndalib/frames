import { AsyncMetadata, Authenticator } from '@eleven-am/authorizer';
import { SessionService } from '../session/session.service';

export const authorizationOptions: AsyncMetadata = {
    inject: [SessionService],
    useFactory: (sessionService: SessionService): Authenticator => ({
        allowNoRulesAccess: (context) => sessionService.allowNoRulesAccess(context),
        retrieveUser: (context) => sessionService.retrieveUser(context),
    })
}