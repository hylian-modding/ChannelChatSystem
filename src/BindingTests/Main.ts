import { EventsClient, EventHandler } from 'modloader64_api/EventHandler';
import { IModLoaderAPI, IPlugin } from 'modloader64_api/IModLoaderAPI';
import { SidedProxy, ProxySide } from "modloader64_api/SidedProxy/SidedProxy";
import { Client } from './Client';
import { Server } from './Server';

/*
    TODO:
        - Hook up with the account system
            - Use flags to give higher-privilaged users more privilages (EX: Devs can see stuff like account, uuid, full timestamps)

        - Object cleanup & organization on Client (For example, I could probably merge the abstract data objects into one thing each for client / server)

        - Markdown-style text rendering
            - Emotes

        - Commands (such as '/joinchannel hax' and '/tell Smurf Pappa')

        - Message options (The ability to copy a message, or click on a user's message to shortcut things like '/tell [user] and '/block [user]')

        - Message streaming. We probably don't need every user to download the whole message history of a channel, I imagine this could get big with global channels, so streaming messages based on the viewport is more optimal

        - Highly compressed logging so we can ban skrubs

        - Purge dead channels
            - Purge ancient messages in living channels

*/

export class BindingTests implements IPlugin {
    ModLoader = {} as IModLoaderAPI
    name = "BindingTests"

    @SidedProxy(ProxySide.CLIENT, Client)
    client!: Client;

    @SidedProxy(ProxySide.SERVER, Server)
    server!: Server;

    constructor() {}
    preinit(): void {}
    init(): void {}
    postinit(): void {}

    onTick(frame: number): void {}

    @EventHandler(EventsClient.ON_INJECT_FINISHED)
    onClient_InjectFinished(evt: any) {}
}

module.exports = BindingTests
