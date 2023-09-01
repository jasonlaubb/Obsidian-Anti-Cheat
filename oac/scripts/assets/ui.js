import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const settings = [
    { name: "Anti Fly", scoreboard: "oac:anti-fly-enabled" },
    { name: "Anti Speed", scoreboard: "oac:anti-speed-enabled" },
    { name: "Anti Scaffold", scoreboard: "oac:anti-scaffold-enabled" },
    { name: "Anti Auto Clicker", scoreboard: "oac:anti-autoclicker-enabled" },
    { name: "Anti Kill Aura", scoreboard: "oac:anti-killaura-enabled" },
    { name: "Anti Spam", scoreboard: "oac:anti-spam-enabled" },
    { name: "Death Coordinates", scoreboard: "oac:death-coordinates-enabled" },
];

function toggleSetting(setting, isSettingEnabled) {
    const checkSettings = world.scoreboard.getObjective(setting.scoreboard) !== undefined;
    if (isSettingEnabled && !checkSettings) world.scoreboard.addObjective(setting.scoreboard, "dummy");
    if (!isSettingEnabled && checkSettings) world.scoreboard.removeObjective(setting.scoreboard);
}

function checkScoreboardObjective() {
    const objectivesToCheck = ["oac:banList", "oac:muteList", "oac:frozenList"];

    for (const objective of objectivesToCheck) {
        if (!world.scoreboard.getObjective(objective)) {
            world.scoreboard.addObjective(objective, "dummy");
        }
    }
}

export function mainMenu(player) {
    checkScoreboardObjective();

    new ActionFormData()
        .title(`Obsidian Anti Cheat`)
        .button("§l§¶Settings", "textures/ui/settings_glyph_color_2x.png")
        .button("§l§¶Commands", "textures/ui/creator_glyph_color.png")
        .button("§l§¶Exit", "textures/ui/cancel.png")
        .show(player)
        .then(res => {
            if (!res.canceled) {
                if (res.selection === 0) settingsMenu(player);
                if (res.selection === 1) commandsMenu(player);
            }
        });
}

export function settingsMenu(player) {
    const form = new ModalFormData().title("Settings");
    settings.forEach(setting => form.toggle(setting.name, world.scoreboard.getObjective(setting.scoreboard) !== undefined));
    form.show(player)
        .then(res => {
            if (res.canceled) player.sendMessage("§l§uOAC§r >§c Settings Discard Changes!");
            else settings.forEach((setting, index) => toggleSetting(setting, res.formValues[index]));
            mainMenu(player);
        });
}

export function commandsMenu(player) {
    const form = new ActionFormData()
        .title("Commands")
        .button("§l§¶Ban Player", "textures/blocks/barrier.png")
        .button("§l§¶Unban Player", "textures/ui/confirm.png")
        .button("§l§¶Mute Player", "textures/ui/mute_on.png")
        .button("§l§¶Unmute Player", "textures/ui/mute_off.png")
        .button("§l§¶Freeze Player", "textures/ui/icon_winter.png")
        .button("§l§¶Unfreeze Player", "textures/ui/speed_effect.png")
        .button("§l§¶Back", "textures/ui/arrow_l_default.png");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 6) return mainMenu(player);

        if (res.selection === 0) playersMenu(player, banMenu);
        if (res.selection === 1) participantsMenu(player, unbanMenu, "oac:banList");
        if (res.selection === 2) playersMenu(player, muteMenu);
        if (res.selection === 3) participantsMenu(player, unmuteMenu, "oac:muteList");
        if (res.selection === 4) playersMenu(player, freezeMenu);
        if (res.selection === 5) participantsMenu(player, unfreezeMenu, "oac:frozenList");
    });
}

export function playersMenu(player, action) {
    const form = new ActionFormData().title("Player Selection");
    const players = [...world.getPlayers({ excludeTags: ["admin"] })];

    players.forEach(plr => {
        form.button(plr.name, "textures/ui/permissions_member_star.png");
    });

    form.button("Back", "textures/ui/arrow_l_default.png");

    form.show(player).then(res => {
        if (!res.canceled) commandsMenu(player);
        if (players[res.selection]) action(player, players[res.selection]);
    });
}

export function participantsMenu(player, action, objectiveName) {
    const form = new ActionFormData().title("Player Selection");
    const participants = world.scoreboard.getObjective(objectiveName).getParticipants();

    participants.forEach(participant => {
        form.button(participant.displayName, "textures/ui/permissions_member_star.png");
    });

    form.button("Back", "textures/ui/arrow_l_default.png");

    form.show(player).then(res => {
        if (!res.canceled) commandsMenu(player);
        if (participants[res.selection]) {
            const selectedPlayer = participants[res.selection].displayName;
            action(player, selectedPlayer);
        }
    });
}

export function banMenu(player, selectedPlayer) {
    const form = new ModalFormData()
        .title(`Ban Player: ${selectedPlayer.name}`)
        .textField("§l§¶Reason", "§7§l§o§¶Type Here");

    form.show(player).then((res) => {
        if (res.canceled) return;

        const reason = res.formValues[0] ?? "";
        const reasonText = reason ? `\n§r§l§c§¶Reason:§r§l§¶ ${reason}` : "";

        player.runCommandAsync(`scoreboard players add "${selectedPlayer.name}" oac:banList 1`);
        player.runCommandAsync(`kick "${selectedPlayer.name}" §l§c§¶You are banned from this server!${reasonText}\n§r§l§c§¶By:§r§l§¶ ${player.name}`);
        world.sendMessage(`§l§u§¶OAC >§c ${selectedPlayer.name} has been banned${reasonText}`);
    });
}

export function unbanMenu(player, selectedPlayer) {
    const form = new ModalFormData()
        .title(`Unban Player: ${selectedPlayer}`)
        .textField("§l§¶Reason", "§7§l§o§¶Type Here");

    form.show(player).then(res => {
        if (res.canceled) return;

        const reason = res.formValues[0] ?? "";
        const reasonText = reason ? `\n§r§l§c§¶Reason:§r§l§¶ ${reason}` : "";

        player.runCommandAsync(`scoreboard players reset "${selectedPlayer}" oac:banList`);
        world.sendMessage(`§l§u§¶OAC >§a ${selectedPlayer} has been unbanned${reasonText}`);
    });
}

export function muteMenu(player, selectedPlayer) {
    const form = new ModalFormData()
        .title(`Mute Player: ${selectedPlayer.name}`)
        .textField("§l§¶Reason", "§7§l§o§¶Type Here");

    form.show(player).then(res => {
        if (res.canceled) return;

        const reason = res.formValues[0] ?? "";
        const reasonText = reason ? `\n§r§l§c§¶Reason:§r§l§¶ ${reason}` : "";

        player.runCommandAsync(`scoreboard players add "${selectedPlayer.name}" oac:muteList 1`);
        world.sendMessage(`§l§u§¶OAC >§c ${selectedPlayer.name} has been muted${reasonText}`);
    });
}

export function unmuteMenu(player, selectedPlayer) {
    const form = new ModalFormData()
        .title(`Unmute Player: ${selectedPlayer}`)
        .textField("§l§¶Reason", "§7§l§o§¶Type Here");

    form.show(player).then(res => {
        if (res.canceled) return;

        const reason = res.formValues[0] ?? "";
        const reasonText = reason ? `\n§r§l§c§¶Reason:§r§l§¶ ${reason}` : "";

        player.runCommandAsync(`scoreboard players reset "${selectedPlayer}" oac:muteList`);
        world.sendMessage(`§l§u§¶OAC >§a ${selectedPlayer} has been unmuted${reasonText}`);
    });
}

export function freezeMenu(player, selectedPlayer) {
    const form = new ModalFormData()
        .title(`Freeze Player: ${selectedPlayer.name}`)
        .textField("§l§¶Reason", "§7§l§o§¶Type Here");

    form.show(player).then(res => {
        if (res.canceled) return;

        const reason = res.formValues[0] ?? "";
        const reasonText = reason ? `\n§r§l§c§¶Reason:§r§l§¶ ${reason}` : "";

        player.runCommandAsync(`scoreboard players add "${selectedPlayer.name}" oac:frozenList 1`);
        world.sendMessage(`§l§u§¶OAC >§c ${selectedPlayer.name} has been frozen${reasonText}`);
    });
}

export function unfreezeMenu(player, selectedPlayer) {
    const form = new ModalFormData()
        .title(`Unfreeze Player: ${selectedPlayer}`)
        .textField("§l§¶Reason", "§7§l§o§¶Type Here");

    form.show(player).then(res => {
        if (res.canceled) return;

        const reason = res.formValues[0] ?? "";
        const reasonText = reason ? `\n§r§l§c§¶Reason:§r§l§¶ ${reason}` : "";

        player.runCommandAsync(`scoreboard players reset "${selectedPlayer}" oac:frozenList`);
        world.sendMessage(`§l§u§¶OAC >§a ${selectedPlayer} has been unfrozen${reasonText}`);
    });
}