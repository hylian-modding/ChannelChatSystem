import { Init, Preinit, Postinit, onTick, onViUpdate } from 'modloader64_api/PluginLifecycle';
import { IModLoaderAPI, ModLoaderEvents } from 'modloader64_api/IModLoaderAPI';
import { ModLoaderAPIInject } from 'modloader64_api/ModLoaderAPIInjector';
import { ChatChannel,  ChatMessage, ChatterInfo, ClientCommands, ServerCommands } from './ChatData';
import { ChatMessagePacket, JoinLeaveChannelPacket, QueryChannelPacket, RequestChatterInfoPacket } from './ChatPackets';
import { NetworkHandler } from 'modloader64_api/NetworkHandler';
import { bool_ref, Col, Dir, HoveredFlags, IImGui, InputTextFlags, number_ref, string_ref, TabBarFlags, TabItemFlags, WindowFlags } from 'modloader64_api/Sylvain/ImGui';
import { rgba, vec4, xy } from 'modloader64_api/Sylvain/vec';
import { throws } from 'assert';

class ChatTabItem {
    active: bool_ref = [true]
    flags: TabItemFlags = TabItemFlags.NoTooltip
    input_text: string_ref = [""]
}

class ChatWindow {
    active: bool_ref = [true]
    channels: any = {}
    channel_tabs: any = {}

    channel_new_active: bool_ref = [false]
    channel_new_text: string_ref = [""]

    settings_active: bool_ref = [false]

    floor_locked: boolean = false //TODO: I have no way of getting the scrollwheel?! Can't lock to the bottom permentantly, so I will disable for now and just move the view to the floor when a user gets a new message
    delete_me_new_message_fuck: boolean = false

    custom_style_exit: vec4 = rgba(200, 128, 128, 255)
    custom_style_exit_active: vec4 = rgba(128, 0, 0, 255)
    custom_style_exit_hover: vec4 = rgba(255, 128, 128, 255)

    custom_style_settings: vec4 = rgba(64, 128, 64, 255)
    custom_style_settings_active: vec4 =rgba(0, 64, 0, 255)
    custom_style_settings_hover: vec4 = rgba(128, 255, 128, 255)

    custom_style_text_debug_uuid: vec4 = rgba(48, 128, 24, 200)
    custom_style_text_timestamp: vec4 = rgba(24, 48, 128, 200)
}

const HelpText: string = 
`/? or /help: Display this page.`
// /tell <player name> <message>: Sends <player name> a private message containing <message>`

export class Client {
    @ModLoaderAPIInject() ModLoader!: IModLoaderAPI;

    chatter!: ChatterInfo
    current_channel: string = ""

    cwind_context: ChatWindow = new ChatWindow()

    ImGui!: IImGui

    drawChat() {
        let padpad_offsetx = this.ImGui.getStyle().framePadding.x + this.ImGui.getStyle().windowPadding.x

        if(this.ImGui.begin("Chat", this.cwind_context.active, WindowFlags.NoTitleBar)) {
            this.ImGui.beginTabBar("ChatTabs", TabBarFlags.Reorderable | TabBarFlags.AutoSelectNewTabs | TabBarFlags.FittingPolicyResizeDown)

            Object.keys(this.cwind_context.channels).forEach((key: string) => {
                if(this.ImGui.beginTabItem(this.cwind_context.channels[key].friendly_name, this.cwind_context.channel_tabs[key].active, this.cwind_context.channel_tabs[key].flags))
                {
                    if (key != this.current_channel) {
                        this.ModLoader.clientSide.sendPacket(new QueryChannelPacket({} as any as undefined, key))
                        this.current_channel = key
                    }

                    this.ImGui.endTabItem()

                    if (this.cwind_context.channel_tabs[key] !== undefined && !this.cwind_context.channel_tabs[key].active[0]) {
                        this.ModLoader.clientSide.sendPacket(new JoinLeaveChannelPacket(key, false))

                        delete this.cwind_context.channel_tabs[key]
                        delete this.cwind_context.channels[key]

                        if (this.current_channel === key) this.current_channel = "World"
                    }
                }
            })

            this.ImGui.sameLine()
            if (this.ImGui.arrowButton("##newtabbutton", Dir.Right)) {
                this.cwind_context.channel_new_active = [true]
            }

            if (this.cwind_context.channel_new_active[0]) {
                this.ImGui.openPopup("##newtabpop")
                if (this.ImGui.beginPopup("##newtabpop")) {
                    this.ImGui.sameLine(this.ImGui.calcItemWidth() - 8)
                    this.ImGui.pushStyleColor(Col.Button, this.cwind_context.custom_style_exit)
                    this.ImGui.pushStyleColor(Col.ButtonActive, this.cwind_context.custom_style_exit_active)
                    this.ImGui.pushStyleColor(Col.ButtonHovered, this.cwind_context.custom_style_exit_hover)
                    if (this.ImGui.smallButton("##exitpop")) this.cwind_context.channel_new_active = [false]
                    this.ImGui.popStyleColor(3)

                    this.ImGui.separator()

                    if (this.ImGui.inputTextWithHint("##newtab", "Input new channel name here", this.cwind_context.channel_new_text, InputTextFlags.EnterReturnsTrue)) {
                        this.cwind_context.channel_new_text[0] = this.cwind_context.channel_new_text[0].replace(/[&\/\\,+()$~%.'"`:;*!?@^=|<>{}\s\[\]]/g, "")
                        this.cwind_context.channel_new_text[0] = this.cwind_context.channel_new_text[0].replace(/[#].*(\D)/g, "")
                        this.cwind_context.channel_new_text[0] = this.cwind_context.channel_new_text[0].replace(/[#].*([#])/g, "")
                        this.cwind_context.channel_new_active = [false]
                        if (this.cwind_context.channel_new_text[0] !== "") this.ModLoader.clientSide.sendPacket(new QueryChannelPacket({} as any as undefined, this.cwind_context.channel_new_text[0]))
                        this.cwind_context.channel_new_text = [""]
                    }

                    this.ImGui.endPopup()
                }
            }

            this.ImGui.endTabBar()

            if (this.cwind_context.channels[this.current_channel] !== undefined) {
                this.ImGui.beginChild("##chat_frame", xy(this.ImGui.getWindowWidth(), this.ImGui.getWindowHeight() - 84), true, WindowFlags.NoScrollbar)
                this.ImGui.separator()

                let this_message: ChatMessage = {} as any as ChatMessage
                for (let index = 0; index < this.cwind_context.channels[this.current_channel].messages.length; index++) {
                    this_message = this.cwind_context.channels[this.current_channel].messages[index]
                    let user = this_message.chatter_info.uuid
                    let this_time = new Date(this_message.timestamp).getTime()

                    if (this.cwind_context.channels[this.current_channel].messages[index - 1] !== undefined) {
                        let diff = this_time - new Date(this.cwind_context.channels[this.current_channel].messages[index - 1].timestamp).getTime()
                        if (this.cwind_context.channels[this.current_channel].messages[index - 1].chatter_info.uuid === user) {
                            if (diff > 5000) {
                                this.ImGui.separator()
                                this.ImGui.spacing()
                            }
                        }
                        else {
                            this.ImGui.spacing()
                            if (diff > 10000) {
                                this.ImGui.separator()
                                this.ImGui.spacing()
                            }
                        }
                    }

                    this.ImGui.pushTextWrapPos(this.ImGui.getWindowContentRegionWidth())

                    this.ImGui.textColored("[" + this_message.chatter_info.uuid + "] ", this.cwind_context.custom_style_text_debug_uuid)

                    this.ImGui.sameLine(0, 2)
                    this.ImGui.textColored("{" + new Date(this_message.timestamp).toLocaleTimeString() + "} ", this.cwind_context.custom_style_text_timestamp)

                    this.ImGui.sameLine(0, 2)
                    this.ImGui.textDisabled(this_message.chatter_info.character_name)

                    this.ImGui.sameLine(0, 1)
                    this.ImGui.text(":  " + this_message.message)

                    this.ImGui.popTextWrapPos()

                    if (this.cwind_context.floor_locked) this.ImGui.setScrollHereY()
                    if (this.cwind_context.delete_me_new_message_fuck && index === this.cwind_context.channels[this.current_channel].messages.length - 1 ) {
                        this.cwind_context.delete_me_new_message_fuck = false
                        this.ImGui.setScrollHereY()
                    }
                }

                this.ImGui.endChild()

                this.ImGui.spacing()
                this.ImGui.separator()

                this.ImGui.pushStyleColor(Col.Button, this.cwind_context.custom_style_settings)
                this.ImGui.pushStyleColor(Col.ButtonActive, this.cwind_context.custom_style_settings_active)
                this.ImGui.pushStyleColor(Col.ButtonHovered, this.cwind_context.custom_style_settings_hover)
                if(this.ImGui.button("##Settings", xy(26, this.ImGui.getFrameHeight()))) this.cwind_context.settings_active[0] = !this.cwind_context.settings_active[0]
                this.ImGui.popStyleColor(3)

                if (this.cwind_context.settings_active[0]) {
                    this.ImGui.openPopup("##settingspop")
                    if (this.ImGui.beginPopup("##settingspop", WindowFlags.None)) {
                        this.ImGui.sameLine()

                        // ImGui treats margins pretty weirdly, so I used width / 4 instead of width??
                        this.ImGui.sameLine(this.ImGui.getWindowContentRegionWidth() - (padpad_offsetx + (24 / 4)))
                        this.ImGui.pushStyleColor(Col.Button, this.cwind_context.custom_style_exit)
                        this.ImGui.pushStyleColor(Col.ButtonActive, this.cwind_context.custom_style_exit_active)
                        this.ImGui.pushStyleColor(Col.ButtonHovered, this.cwind_context.custom_style_exit_hover)
                        if (this.ImGui.button("##exitsettingspop", xy(24, this.ImGui.getFrameHeight()))) this.cwind_context.settings_active = [false]
                        this.ImGui.popStyleColor(3)

                        this.ImGui.separator()
                        this.ImGui.spacing()

                        this.ImGui.beginChild("##styleedit",xy(600, 800), undefined, WindowFlags.NoMove)
                        this.ImGui.showStyleEditor()
                        this.ImGui.endChild()
                        this.ImGui.endPopup()
                    }
                }

                this.ImGui.setNextItemWidth(this.ImGui.getWindowContentRegionWidth() - (padpad_offsetx + 26))
                this.ImGui.sameLine(0, 2)
                if (this.ImGui.inputTextWithHint("##chatbar", "Start typing to chat. Use /? for commands.", this.cwind_context.channel_tabs[this.current_channel].input_text, InputTextFlags.EnterReturnsTrue))
                {
                    if (this.cwind_context.channel_tabs[this.current_channel].input_text[0] !== "") {
                        // Regex test to see if the string starts with "/"
                        let isCommand = /^\//.test(this.cwind_context.channel_tabs[this.current_channel].input_text[0])
                        if(isCommand){
                            // Command Handler
                            let commandMessage: ChatMessage = new ChatMessage(this.chatter, new Date(), this.cwind_context.channel_tabs[this.current_channel].input_text[0], this.current_channel)
                            this.cwind_context.channels[this.current_channel].messages.push(commandMessage)
                            
                            let command: string = commandMessage.message.match(/^\/\S+/)![0]

                            if(!ServerCommands.includes(command)){ // If it's NOT a server command
                                switch (command){
                                    // Commands the client can handle
                                    case ClientCommands[0]: // /?
                                    case ClientCommands[1]:{ // /help
                                        let chatter: ChatterInfo = new ChatterInfo(this.chatter.uuid, this.chatter.account, "Command", this.chatter.account_flags)
                                        let responseMessage: ChatMessage = new ChatMessage(chatter, new Date(), HelpText, this.current_channel)
                                        this.cwind_context.channels[this.current_channel].messages.push(responseMessage)
                                        break
                                    }
                                    // Invalid Commands
                                    default:{
                                        let chatter: ChatterInfo = new ChatterInfo(this.chatter.uuid, this.chatter.account, "Command", this.chatter.account_flags)
                                        let responseMessage: ChatMessage = new ChatMessage(chatter, new Date(), "Error: Invalid Command", this.current_channel)
                                        this.cwind_context.channels[this.current_channel].messages.push(responseMessage)
                                        break
                                    }
                                }
                            } else { // If it IS a server command 
                                let commandPacket: ChatMessagePacket = new ChatMessagePacket(commandMessage, true)
                                this.ModLoader.clientSide.sendPacket(commandPacket)
                            }
                            
                            this.cwind_context.channel_tabs[this.current_channel].input_text = [""]
                            this.cwind_context.delete_me_new_message_fuck = true
                            // If it's a command for the server to handle
                            // If it's an invalid command
                        } else {
                            // Normal Message
                            let message: ChatMessage = new ChatMessage(this.chatter, new Date(), this.cwind_context.channel_tabs[this.current_channel].input_text[0], this.current_channel)
                            let packet: ChatMessagePacket = new ChatMessagePacket(message)
                            this.ModLoader.clientSide.sendPacket(packet)
                            this.cwind_context.channel_tabs[this.current_channel].input_text = [""]
                            this.cwind_context.channels[this.current_channel].messages.push(message)
                            this.cwind_context.delete_me_new_message_fuck = true
                        }
                    }
                }
            }
        }

        this.ImGui.end()
    }

    @Preinit()
    preinit() {}

    @Init()
    init() {}

    @Postinit()
    postinit() {
        this.ImGui = this.ModLoader.ImGui

        this.current_channel = "World"
        this.ModLoader.clientSide.sendPacket(new JoinLeaveChannelPacket("World", true))
        this.ModLoader.clientSide.sendPacket(new QueryChannelPacket({} as any as undefined, "World"))
        this.ModLoader.clientSide.sendPacket(new RequestChatterInfoPacket({} as any as undefined))
        this.ImGui.styleColorsDark()
        this.ModLoader.logger.debug("[Client]: PostInit finished")
    }

    @onTick()
    onTick(frame: number) {}

    @onViUpdate()
    onViUpdate() {
        try {
            this.drawChat()
        } catch(err) { this.ModLoader.logger.error("Error in drawChat(): " + err) }
    }

    @NetworkHandler("requestChatterInfo")
    onGetChatterInfo(packet: RequestChatterInfoPacket) {
        this.chatter = packet.chatter
    }

    @NetworkHandler("chatMessage")
    onGetChatMessage(packet: ChatMessagePacket) {
        this.cwind_context.delete_me_new_message_fuck = true
        if (packet.player.uuid === this.ModLoader.me.uuid) return

        this.ModLoader.logger.info("[CLIENT]: Recieved message in channel " + packet.message.channel_id + ", message: " + packet.message.message)
        if (this.cwind_context.channels[packet.message.channel_id] !== undefined) this.cwind_context.channels[packet.message.channel_id].messages.push(packet.message)
    }

    @NetworkHandler("queryChannel")
    onGetChannelQuery(packet: QueryChannelPacket) {
        this.cwind_context.channels[packet.channel_id] = packet.channel_data
        this.cwind_context.channel_tabs[packet.channel_id] = new ChatTabItem()
        this.ModLoader.logger.info("Queried channel " + packet.channel_id)
    }

    @NetworkHandler('joinChannel')
    onJoinChannel(packet: JoinLeaveChannelPacket) {
        if (packet.player.uuid === this.ModLoader.me.uuid) return

        if (this.cwind_context.channels[packet.channel_id]) {
            let index = this.cwind_context.channels[packet.channel_id].is_chatter_in_channel(packet.player.uuid)
            if (index === -1) this.ModLoader.clientSide.sendPacket(new QueryChannelPacket({} as any as undefined, packet.channel_id))
        }
    }

    @NetworkHandler('leaveChannel')
    onLeaveChannel(packet: JoinLeaveChannelPacket) {
        if (packet.player.uuid === this.ModLoader.me.uuid) return

        if (this.cwind_context.channels[packet.channel_id]) {
            let index = this.cwind_context.channels[packet.channel_id].is_chatter_in_channel(packet.player.uuid)
            if (index !== -1) {
                this.cwind_context.channels[packet.channel_id].chatters.slice(index)
                this.ModLoader.clientSide.sendPacket(new QueryChannelPacket({} as any as undefined, packet.channel_id))
            }
        }
    }
}

export default Client