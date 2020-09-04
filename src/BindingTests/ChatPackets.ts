import { Packet, packetHelper, UDPPacket} from 'modloader64_api/ModLoaderDefaultImpls';
import { ChatChannel, ChatterInfo, ChatMessage } from './ChatData'
import { sign } from 'crypto';
import { throws } from 'assert';

const GLOBAL_LOBBY = "__GLOBAL__"

export class ChatMessagePacket extends Packet {
    message: ChatMessage

    constructor(message: ChatMessage) {
        super('chatMessage', 'irc', GLOBAL_LOBBY, false)
        this.message = message
    }
}

export class RequestChatterInfoPacket extends Packet {
    chatter!: ChatterInfo

    constructor(chatter: ChatterInfo | undefined) {
        super('requestChatterInfo', 'irc', GLOBAL_LOBBY, false)
        if (chatter !== undefined) this.chatter = chatter
    }
}

export class QueryChannelPacket extends Packet {
    channel_data!: ChatChannel
    channel_id: string = ""

    constructor(channel_data: ChatChannel | undefined, channel_id: string | undefined) {
        super('queryChannel', 'irc', GLOBAL_LOBBY, false)
        if (channel_data !== undefined) this.channel_data = channel_data
        if (channel_id !== undefined) this.channel_id = channel_id
    }
}

// When a client sends this, they have joined/left a channel, when it gets it, a player has joined/left the channel
export class JoinLeaveChannelPacket extends Packet {
    channel_id: string = ""

    constructor(channel_id: string, joining: boolean) {
        super(joining ? 'joinChannel' : 'leaveChannel', 'irc', GLOBAL_LOBBY, false)
        this.channel_id = channel_id
    }
}

