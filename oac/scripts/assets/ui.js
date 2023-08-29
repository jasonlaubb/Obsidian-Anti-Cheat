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

export function mainMenu(player) {
    new ActionFormData()
        .title(`Obsidian Anti Cheat`)
        .button("§l§¶Settings", "textures/ui/settings_glyph_color_2x.png")
        .button("§l§¶Exit", "textures/ui/cancel.png")
        .show(player)
        .then(res => {
            if (!res.canceled && res.selection === 0) settingsMenu(player);
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
