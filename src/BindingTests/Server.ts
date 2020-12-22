import { EventHandler, EventsServer, EventServerJoined, EventServerLeft, bus } from 'modloader64_api/EventHandler';
import { ParentReference, SidedProxy, ProxySide } from 'modloader64_api/SidedProxy/SidedProxy';
import { ModLoaderAPIInject } from 'modloader64_api/ModLoaderAPIInjector';
import { IModLoaderAPI, ModLoaderEvents } from 'modloader64_api/IModLoaderAPI';
import { IPacketHeader, ServerNetworkHandler, INetworkPlayer } from 'modloader64_api/NetworkHandler';
import { Packet } from 'modloader64_api/ModLoaderDefaultImpls';
import { throws } from 'assert';
import { BindingTests } from './Main';
import ChatStorage from './ChatStorage';
import ChatChannel, { ChatMessage, ChatterInfo, ServerCommands } from './ChatData';
import { ChatMessagePacket, JoinLeaveChannelPacket, QueryChannelPacket, RequestChatterInfoPacket } from './ChatPackets';
import { Init, Postinit } from 'modloader64_api/PluginLifecycle';

export class Server {
    @ModLoaderAPIInject() ModLoader!: IModLoaderAPI;
    @ParentReference() parent!: BindingTests

    storage: ChatStorage = new ChatStorage()
    server_chatter!: ChatterInfo
    nchatters: number = 0 // just for test

    send_update_to_channel(packet: ChatMessagePacket, id: string) {
        if (this.storage.channels[id] === undefined) this.create_channel(id)

        for (let i = 0; i < this.storage.channels[id].chatters.length; i++) {
            this.ModLoader.serverSide.sendPacketToSpecificPlayer(packet, this.storage.networkPlayerInstances[this.storage.channels[id].chatters[i].uuid])
        }
    }

    send_server_message(message: string) {
        let new_message: ChatMessage = new ChatMessage(this.server_chatter, new Date(), message, "")
        Object.keys(this.storage.channels).forEach((key: string) => {
            new_message.channel_id = this.storage.channels[key].id
            this.storage.channels[key].messages.push(new_message)
            this.send_update_to_channel(new ChatMessagePacket(new_message), key)
        })
    }

    send_server_message_to_channel(message: string, id: string) {
        let new_message: ChatMessage = new ChatMessage(this.server_chatter, new Date(), message, id)

        if (this.storage.channels[id] === undefined) this.create_channel(id)

        this.storage.channels[id].messages.push(new_message)
        this.send_update_to_channel(new ChatMessagePacket(new_message), id)
    }

    create_channel(id: string) {
        if (this.storage.channels[id] === undefined) {
            this.storage.channels[id] = new ChatChannel(id, id, false)
            this.send_server_message_to_channel("Creating channel...", id)
            this.send_server_message_to_channel("Channel \"" + id + "\" created at " + new Date().toTimeString() + ".", id)
        }
    }

    @Postinit()
    postinit() {
        this.server_chatter = new ChatterInfo(this.ModLoader.utils.getUUID(), "SERVER", "SERVER", 0)
        this.ModLoader.logger.warn("[Server]: PostInit finished")
    }

    @EventHandler(EventsServer.ON_LOBBY_CREATE)
    onLobbyCreated(lobby: string) {
        try {}
        catch(err) { this.ModLoader.logger.error("Failed to create lobby: " + err) }
    }

    @EventHandler(EventsServer.ON_LOBBY_JOIN)
    onLobbyJoinedServer(evt: EventServerJoined) {
        this.storage.networkPlayerInstances[evt.player.uuid] = evt.player
        this.storage.chatters[evt.player.uuid] = new ChatterInfo(evt.player.uuid, evt.player.uuid, "PLAYER" + this.nchatters.toString(), 0)
    }

    @EventHandler(EventsServer.ON_LOBBY_LEAVE)
    onLobbyLeftServer(evt: EventServerLeft) {
        delete this.storage.networkPlayerInstances[evt.player.uuid]

        let index = -1
        Object.keys(this.storage.channels).forEach((key: string) => {
            index = this.storage.channels[key].is_chatter_in_channel(evt.player.uuid)
            if (index !== -1) this.storage.channels[key].chatters.slice(index)
        })

        delete this.storage.chatters[evt.player.uuid]
    }

    @ServerNetworkHandler('requestChatterInfo')
    onRequestChatterInfo(packet: Packet) {
        this.ModLoader.serverSide.sendPacketToSpecificPlayer(new RequestChatterInfoPacket(this.storage.chatters[packet.player.uuid]), this.storage.networkPlayerInstances[packet.player.uuid])
    }

    @ServerNetworkHandler('chatMessage')
    onChatMessage(packet: ChatMessagePacket) {
        this.ModLoader.logger.warn("[SERVER]: Recieved message in channel " + packet.message.channel_id + ", message: " + packet.message.message)
        if (this.storage.channels[packet.message.channel_id] === undefined) this.create_channel(packet.message.channel_id)

        this.storage.channels[packet.message.channel_id].messages.push(packet.message)
        this.send_update_to_channel(packet, packet.message.channel_id)
    }

    @ServerNetworkHandler('commandMessage')
    onCommandMessage(packet: ChatMessagePacket) {
        let command: RegExpMatchArray = packet.message.message.match(/"([^"]+)"|'([^']+)'|\S+/g)!

        this.ModLoader.logger.warn("[SERVER]: Recieved command in channel " + packet.message.channel_id + ", command: " + command[0])
        switch (command[0]){
            // case (ServerCommands[0]):{ // /tell
            //     if(packet.message.args.length >= 2){ // If it has enough arguments or more
            //         let toPlayer: string | undefined = packet.message.args.shift() // Grr, it won't be undefined but typescript won't let me just shift()
            //         toPlayer = toPlayer || ""
            //         let message: string = packet.message.args.join(" ")

            //         if(/'([^']+)'|"([^"]+)"/.test(toPlayer)){
            //             toPlayer = 
            //         }
            //     } else { // If it doesn't have the required arguments

            //     }
            //     break
            // }

            // Pausing work on the /tell command for now, until DM's are implemented. When it is, /tell will probably just open a DM
        }
    }

    @ServerNetworkHandler('queryChannel')
    onQueryChannel(packet: QueryChannelPacket) {
        if (this.storage.channels[packet.channel_id] === undefined) this.create_channel(packet.channel_id)

        packet.channel_data = this.storage.channels[packet.channel_id]
        this.ModLoader.serverSide.sendPacketToSpecificPlayer(packet, this.storage.networkPlayerInstances[packet.player.uuid])

        let index = this.storage.channels[packet.channel_id].is_chatter_in_channel(packet.player.uuid)
        if (index === -1) {
            this.storage.channels[packet.channel_id].chatters.push(this.storage.chatters[packet.player.uuid])
            let newPacket = new JoinLeaveChannelPacket(packet.channel_id, true)
            newPacket.player = packet.player
            this.ModLoader.serverSide.sendPacket(newPacket)
        }
    }

    @ServerNetworkHandler('joinChannel')
    onjoinChannel(packet: JoinLeaveChannelPacket) {
        if (this.storage.channels[packet.channel_id] === undefined) this.create_channel(packet.channel_id)

        let index = this.storage.channels[packet.channel_id].is_chatter_in_channel(packet.player.uuid)
        if (index === -1) this.storage.channels[packet.channel_id].chatters.push(this.storage.chatters[packet.player.uuid])

        this.ModLoader.serverSide.sendPacket(packet)
        this.ModLoader.logger.warn("User " + packet.player.uuid + " joined lobby " + packet.channel_id)
    }

    @ServerNetworkHandler('leaveChannel')
    onLeaveChannel(packet: JoinLeaveChannelPacket) {
        let index = this.storage.channels[packet.channel_id].is_chatter_in_channel(packet.player.uuid)
        if (index !== -1) this.storage.channels[packet.channel_id].chatters.slice(index)

        this.ModLoader.serverSide.sendPacket(packet)
        this.ModLoader.logger.warn("User " + packet.player.uuid + " left lobby " + packet.channel_id + ", " + index.toString())
    }

}

export default Server