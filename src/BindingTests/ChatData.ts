import { throws } from "assert"

export const ClientCommands: string[] = [
    "/?",
    "/help",
]

export const ServerCommands: string[] = [
    "/tell",
]

export class ChatterInfo {
    uuid: string
    account: string
    character_name: string
    account_flags: number

    constructor(uuid: string, account: string, character_name: string, account_flags: number) {
        this.uuid = uuid
        this.account = account
        this.character_name = character_name
        this.account_flags = account_flags
    }
}

export class ChatMessage {
    chatter_info: ChatterInfo
    timestamp: Date
    message: string
    channel_id: string

    constructor(chatter_info: ChatterInfo, timestamp: Date, message: string, channel_id: string) {
        this.chatter_info = chatter_info
        this.timestamp = timestamp
        this.message = message
        this.channel_id = channel_id
    }
}

export class CommandMessage {
    chatter_info: ChatterInfo
    timestamp: Date
    command: string
    args: string[]
    channel_id: string

    constructor(chatter_info: ChatterInfo, timestamp: Date, command: string, args: string[], channel_id: string) {
        this.chatter_info = chatter_info
        this.timestamp = timestamp
        this.command = command
        this.args = args
        this.channel_id = channel_id
    }
}

export class ChatChannel {
    id: string
    friendly_name: string
    is_lobby_channel: boolean
    chatters: ChatterInfo[] = []
    messages: ChatMessage[] = []
    last_message_time: Date = new Date()

    constructor(id: string, name: string | undefined, is_lobby_channel: boolean) {
        this.id = id

        if (name !== undefined) this.friendly_name = name
        else this.friendly_name = id

        this.is_lobby_channel = is_lobby_channel
    }

    // Returns index, otherwise -1
    is_chatter_in_channel(id: string) {
        for (let i = 0; i < this.chatters.length; i++) {
            if (this.chatters[i].uuid == id) return i
        }

        return -1
    }
}

export default ChatChannel