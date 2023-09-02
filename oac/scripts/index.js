import { world, system, GameMode, Player, MinecraftBlockTypes } from "@minecraft/server";
import { mainMenu } from "./assets/ui.js";
import config from "./assets/config.js";

const playerData = new Map();

system.runInterval(() => {
    const frozenPlayers = world.scoreboard.getObjective("oac:frozenList").getParticipants();

    if (frozenPlayers.length > 0) {
        world.getPlayers({ excludeTags: ["admin"] }).forEach(player => {
            const freezeKey = `${player.id}-checkFreeze`;
            const prevLoc = playerData.get(freezeKey) || player.location;

            const { x, y, z } = player.location;
            const distanceSquared = Math.pow(x - prevLoc.x, 2) + Math.pow(y - prevLoc.y, 2) + Math.pow(z - prevLoc.z, 2);

            if (frozenPlayers.find(p => p.displayName === player.name)) {
                if (distanceSquared > 1) {
                    player.teleport(prevLoc);
                    player.onScreenDisplay.setActionBar("§u§l§¶OAC >§c You are frozen");
                }

                playerData.set(freezeKey, player.location);
            } else {
                playerData.delete(freezeKey);
            }
        });
    }
}, 40);

system.runInterval(() => {
    if (!world.scoreboard.getObjective('oac:anti-fly-enabled')) return;
    world.getPlayers({ excludeTags: ["admin"], excludeGameModes: [GameMode.creative, GameMode.spectator] }).forEach(player => {
        const { id, location: { x, y, z }, dimension, isOnGround, isGliding, isInWater, isSwimming, isFalling, isJumping } = player;
        const currentTime = Date.now();
        const X = Math.trunc(x);
        const Y = Math.trunc(y);
        const Z = Math.trunc(z);
        const antiFlyKey = `${id}-checkFly`;

        if (isOnGround || isGliding || isInWater || isSwimming) {
            if (!playerData.has(antiFlyKey)) {
                playerData.set(antiFlyKey, {});
            }
            playerData.get(antiFlyKey).type = 'flyData';
            playerData.get(antiFlyKey).time = currentTime;
            playerData.get(antiFlyKey).coords = { x: X, y: Y, z: Z };
            return;
        }

        if (isFalling && playerData.has(antiFlyKey)) {
            playerData.get(antiFlyKey).time = Math.max(playerData.get(antiFlyKey).time - 500, 0);
            return;
        }

        if (!isJumping && playerData.has(antiFlyKey)) {
            const { time, coords } = playerData.get(antiFlyKey);
            const airTime = currentTime - time;

            if (airTime >= config.antiFly.maxAirTime && isPlayerOnAir(player)) {
                const { x, z } = player.getVelocity();
                const horizontalVelocity = Math.hypot(x, z).toFixed(4);

                if (Number(horizontalVelocity) > 0) {
                    player.teleport(coords, { dimension, facingLocation: { x: coords.x, y: coords.y - 1, z: coords.z } });
                    world.sendMessage(`§u§l§¶OAC >§4 ${player.name}§c has detected Flying\n§r§l§¶Air time: ${airTime / 1000}s`);
                    player.applyDamage(6);
                }
            }
        }
    });
}, 20);

function isPlayerOnAir({ location: { x, y, z }, dimension }) {
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            for (let k = -1; k <= 1; k++) {
                const block = dimension.getBlock({ x: x + i, y: y + j, z: z + k });
                if (block.typeId !== "minecraft:air") {
                    return false;
                }
            }
        }
    }
    return true;
}

system.runInterval(() => {
    if (!world.scoreboard.getObjective('oac:anti-speed-enabled')) return;
    world.getPlayers({ excludeTags: ["admin"], excludeGameModes: [GameMode.creative, GameMode.spectator] }).forEach(player => {
        const antiSpeedKey = `${player.id}-checkSpeed`;

        if (playerData.has(`${player.id}-hurtTimeKey`) && Date.now() - playerData.get(`${player.id}-hurtTimeKey`) < 3000) {
            return;
        }

        if (player.isGliding || player.getEffect("speed") || player.hasTag("three") || player.hasTag("four")) {
            playerData.set(antiSpeedKey, { type: 'speedData', zeroSpeedLocation: player.location });
            return;
        }

        const { x, z } = player.getVelocity();
        const playerSpeedMph = Math.sqrt(x ** 2 + z ** 2) * 20 * 60 * 60 / 1609.34;

        if (playerSpeedMph === 0) {
            playerData.set(antiSpeedKey, { zeroSpeedLocation: player.location });
        } else if (playerSpeedMph > config.antiSpeed.mphThreshold && playerData.has(antiSpeedKey)) {
            const playerInfo = playerData.get(antiSpeedKey);
            if (!playerInfo.highestSpeed) {
                player.teleport(playerInfo.zeroSpeedLocation, { dimension: player.dimension, rotation: { x: 180, y: 0 } });
                world.sendMessage(`§u§l§¶OAC >§4 ${player.name}§c has detected with Speed\n§r§l§¶${playerSpeedMph.toFixed(2)} mph`);
                player.applyDamage(6);
                playerInfo.highestSpeed = playerSpeedMph;
            }
        } else if (playerSpeedMph <= config.antiSpeed.mphThreshold && playerData.has(antiSpeedKey)) {
            const playerInfo = playerData.get(antiSpeedKey);
            playerInfo.highestSpeed = 0;
        }
    });
}, 2);

world.afterEvents.entityHurt.subscribe(event => {
    if (event.hurtEntity instanceof Player) {
        playerData.set(`${event.hurtEntity.id}-hurtTimeKey`, Date.now());
    }
});

world.afterEvents.blockPlace.subscribe(({ block, player, dimension }) => {
    if (!world.scoreboard.getObjective('oac:anti-scaffold-enabled') || player.hasTag("admin") || !world.getPlayers({ excludeGameModes: [GameMode.creative], name: player.name }).length) return;

    const { location: { x, y, z } } = block;
    const currentTime = Date.now();
    const scaffoldKey = `${player.id}-checkScaffold`;
    const playerAction = playerData.get(scaffoldKey) || [];
    const timeThreshold = currentTime - config.antiScaffold.timer;

    playerAction.push({ type: 'scaffoldData', time: currentTime, position: { x, y, z } });
    const updatedActions = playerAction.filter(action => action.time >= timeThreshold);

    playerData.set(scaffoldKey, updatedActions);

    if (updatedActions.length < config.antiScaffold.maxPlacementsPerSecond) return;

    const [lastAction] = updatedActions;
    const timeDifference = currentTime - lastAction.time;
    const distance = Math.sqrt((x - lastAction.position.x) ** 2 + (y - lastAction.position.y) ** 2 + (z - lastAction.position.z) ** 2);
    const blocksPlacedPerSecond = updatedActions.length / (timeDifference / config.antiScaffold.timer);
    const averageDistance = distance / updatedActions.length;

    if (blocksPlacedPerSecond >= config.antiScaffold.maxPlacementsPerSecond && averageDistance < 1) {
        dimension.getBlock({ x, y, z }).setType(MinecraftBlockTypes.air);
        player.applyDamage(6);
    }
});

const getVector = (p1, p2) => ({ x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z });
const getNDP = (v1, v2) => (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2) * Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2));
const isAttackerOutOfTargetView = (attacker, target) => {
    if (attacker && target) {
        const angleInDegrees = Math.acos(getNDP(attacker.getViewDirection(), getVector(attacker.location, target.location))) * (180 / Math.PI);
        const distance = Math.sqrt(
            (target.location.x - attacker.location.x) ** 2 +
            (target.location.y - attacker.location.y) ** 2 +
            (target.location.z - attacker.location.z) ** 2
        );

        return angleInDegrees > config.antiKillAura.minAngle && distance >= 2;
    }
    return false;
};

const antiKillAura = (damagingEntity, hitEntity) => {
    if (!damagingEntity.hasTag("pvp-off") && isAttackerOutOfTargetView(damagingEntity, hitEntity)) {
        damagingEntity.addTag("pvp-off");
        const angleInDegrees = Math.floor(
            Math.acos(getNDP(damagingEntity.getViewDirection(), getVector(damagingEntity.location, hitEntity.location))) * (180 / Math.PI)
        );
        world.sendMessage(`§u§l§¶OAC >§4 ${damagingEntity.name}§c has detected using Kill Aura\n§r§l§¶Angle: ${angleInDegrees}°`);
        system.runTimeout(() => damagingEntity.removeTag("pvp-off"), config.antiKillAura.timeout);
    }
};

const antiAutoClicker = (player) => {
    const currentTime = Date.now();
    const clickKey = `${player.id}-clickData`;
    const lastData = playerData.get(clickKey) || { lastClickTime: 0, cpsCooldown: null };

    const lastClickTime = lastData.lastClickTime;
    const cpsCooldown = lastData.cpsCooldown;

    if (!player.hasTag("pvp-off") && lastClickTime && currentTime - lastClickTime < 50 && config.antiAutoClicker.cpsCooldownDuration / (currentTime - lastClickTime) >= config.antiAutoClicker.maxClicksPerSecond) {
        player.addTag("pvp-off");
        const cps = config.antiAutoClicker.cpsCooldownDuration / (currentTime - lastClickTime);
        world.sendMessage(`§u§l§¶OAC >§4 ${player.name}§c has detected using Auto Clicker\n§r§l§¶CPS: ${cps.toFixed(2)}`);
    }

    playerData.set(clickKey, { lastClickTime: currentTime, cpsCooldown });

    if (cpsCooldown) system.clearRun(cpsCooldown);
    playerData.get(clickKey).cpsCooldown = system.runTimeout(() => player.removeTag("pvp-off"), config.antiAutoClicker.timeout);
};

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (!(damagingEntity instanceof Player) || damagingEntity.hasTag("admin") || !(hitEntity instanceof Player)) return;
    if (world.scoreboard.getObjective('oac:anti-autoclicker-enabled')) antiAutoClicker(damagingEntity);
    if (world.scoreboard.getObjective('oac:anti-killaura-enabled')) antiKillAura(damagingEntity, hitEntity);
});

const checkSpam = (player, behavior) => {
    world.sendMessage(`§4§l§¶${player.name}§c has detected ${behavior}`);
    player.runCommandAsync(`kick ${player.name} §l§c§¶You have been kicked for ${behavior}`);
};

world.afterEvents.chatSend.subscribe(({ sender: player, message }) => {

    if (!world.scoreboard.getObjective('oac:anti-spam-enabled') || player.hasTag("admin")) return;

    const spamKey = `${player.id}-spamData`;
    const data = playerData.get(spamKey) || { lastMessageTimes: [], warnings: 0 };

    if (player.hasTag('five') && player.isOnGround && !player.isJumping) checkSpam(player, "sending messages while moving");
    if (player.hasTag('one') && !player.getEffect("mining_fatigue")) checkSpam(player, "sending messages while swinging their hand");
    if (player.hasTag('two')) checkSpam(player, "sending messages while using an item");

    if (config.blacklistedMessages.some((word) => message.includes(word))) {
        player.runCommandAsync(`kick ${player.name} §l§c§¶You have been kicked for saying ${message} a blacklisted message`);
        world.sendMessage(`§4§l§¶${player.name}§c has been kicked for saying ${message} a blacklisted message`);
        return;
    }

    const currentTime = Date.now();
    data.lastMessageTimes.push(currentTime);

    if (data.lastMessageTimes.length > config.antiSpam.maxMessagesPerSecond) {
        data.lastMessageTimes.shift();
    }

    if (data.lastMessageTimes.length >= config.antiSpam.maxMessagesPerSecond &&
        data.lastMessageTimes[data.lastMessageTimes.length - 1] - data.lastMessageTimes[0] < config.antiSpam.timer) {
        antiSpam(player, data, spamKey);
    }

    playerData.set(spamKey, data);
});

const antiSpam = (player, data, spamKey) => {
    data.warnings++;

    if (data.warnings <= config.antiSpam.kickThreshold) {
        player.sendMessage(`§c§l§¶Please send messages slowly\n§8§l§¶ Warning ${data.warnings} out of ${config.antiSpam.kickThreshold}`);
    }

    system.runTimeout(() => {
        data.warnings = 0;
        playerData.set(spamKey, data);
    }, config.antiSpam.timeout);

    if (data.warnings > config.antiSpam.kickThreshold) {
        player.runCommandAsync(`kick ${player.name} §l§c§¶You have been kicked for spamming`);
        world.sendMessage(`§4§l§¶${player.name}§c has been kicked for spamming`);
    }
};

world.beforeEvents.chatSend.subscribe((event) => {
    const { message: message, sender: player } = event;

    if (world.scoreboard.getObjective("oac:muteList").getParticipants().find(p => p.displayName === player.name)) {
        event.cancel = true;
        player.sendMessage(`§c§l§¶You are muted`);
    }

    if (!world.scoreboard.getObjective('oac:anti-spam-enabled') || player.hasTag("admin")) return;

    if (message.length > config.antiSpam.maxCharacterLimit) {
        event.cancel = true;
        player.sendMessage(`§c§l§¶Your message is too long\n§8§l§¶The maximum length is ${config.antiSpam.maxCharacterLimit} characters`);
    } else if (config.chatFilter.some((word) => message.toLowerCase().includes(word))) {
        event.cancel = true;
        player.sendMessage(`§c§l§¶Your message contains a filtered word`);
    }
});

world.afterEvents.playerSpawn.subscribe(({ player }) => {
    const banlist = world.scoreboard.getObjective("oac:banList").getParticipants();
    if (banlist.find(p => p.displayName === player.name) {
    player.runCommandAsync(`kick ${player.name} §l§c§¶You are banned from this server`);
    }
});

world.afterEvents.entityDie.subscribe((event) => {
    if (!world.scoreboard.getObjective('oac:death-coordinates-enabled')) return;

    const { deadEntity } = event;

    if (!(deadEntity instanceof Player)) {
        return;
    }

    const { x, y, z } = deadEntity.location;

    deadEntity.sendMessage(`You died at §c${Math.round(x)} §a${Math.round(y)} §b${Math.round(z)} §rin ${deadEntity.dimension.id.replace("minecraft:", "")}`);
});

world.afterEvents.itemUse.subscribe(({ itemStack: item, source: player }) => {
    if (player.typeId === "minecraft:player" && player.hasTag("admin") && item.typeId === "minecraft:chorus_fruit") {
        mainMenu(player);
    }
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    const configObjectives = [
        'oac:anti-speed-enabled',
        'oac:anti-fly-enabled',
        'oac:anti-scaffold-enabled',
        'oac:anti-autoclicker-enabled',
        'oac:anti-killaura-enabled',
        'oac:anti-spam-enabled'
    ];

    if (configObjectives.some(objective => world.scoreboard.getObjective(objective))) {
        playerData.delete(playerId);
    }
});

system.beforeEvents.watchdogTerminate.subscribe((event) => {
    event.cancel = true;
});
