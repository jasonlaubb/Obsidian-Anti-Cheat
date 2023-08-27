import { world, system, GameMode, Player, MinecraftBlockTypes } from "@minecraft/server";
import { mainMenu } from "./assets/ui.js";
import config from "./assets/config.js";

const playerData = new Map();
const cps = new Map();
const cpsCooldown = new Map();
const chatWarnings = new Map();
const lastMessageTimes = new Map();

system.runInterval(() => {
    if (!world.scoreboard.getObjective('oac:anti-fly-enabled')) return;
    world.getPlayers({ excludeGameModes: [GameMode.creative, GameMode.spectator] })
        .filter(player => !player.isOp())
        .forEach(player => {
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
                        world.sendMessage(`§l§uOAC§r >§4 ${player.name}§c has detected Flying\n§rAir time: ${airTime / 1000}s`);
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
    world.getPlayers({ excludeGameModes: [GameMode.creative, GameMode.spectator] })
        .filter(player => !player.isOp())
        .forEach(player => {
            const antiSpeedKey = `${player.id}-checkSpeed`;

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
                    world.sendMessage(`§l§uOAC§r >§4 ${player.name}§c has detected with Speed§r\n${playerSpeedMph.toFixed(2)} mph`);
                    player.applyDamage(6);
                    playerInfo.highestSpeed = playerSpeedMph;
                }
            } else if (playerSpeedMph <= config.antiSpeed.mphThreshold && playerData.has(antiSpeedKey)) {
                const playerInfo = playerData.get(antiSpeedKey);
                playerInfo.highestSpeed = 0;
            }
        });
}, 2);

world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
    if (hurtEntity.isValid() && playerData.has(hurtEntity.id)) {
        const playerInfo = playerData.get(hurtEntity.id);
        playerInfo.lastHitTimestamp = Date.now();
    }
});

system.runInterval(() => {
    if (!world.scoreboard.getObjective('oac:anti-jesus-enabled')) return;
    world.getPlayers({ excludeGameModes: [GameMode.creative, GameMode.spectator] })
        .filter(player => !player.isOp())
        .forEach(player => {
            const { x, y, z } = player.location;
            const blockBelow = player.dimension.getBlock({ x, y: y - 1, z });
            const isOnWater = blockBelow.typeId === "minecraft:water";
            const isSwimmingOrInWater = player.isSwimming || player.isInWater || player.isJumping || player.isFlying || player.hasTag("three");
            const antiJesusKey = `${player.id}-checkJesus`;

            if (!isOnWater || isSwimmingOrInWater) {
                if (player.isOnGround && playerData.has(antiJesusKey)) {
                    playerData.delete(antiJesusKey);
                }
                return;
            }

            const coords = playerData.get(antiJesusKey) || {};
            coords.x = x;
            coords.y = y;
            coords.z = z;
            playerData.set(antiJesusKey, coords);

            const prevBlock = player.dimension.getBlock({ x: coords.x, y: coords.y, z: coords.z });
            const isWater = prevBlock.typeId === "minecraft:water";
            const isSolidBlock = !prevBlock.isAir() && !prevBlock.isLiquid();

            if (isWater && !isSolidBlock) {
                teleportPlayerBelow(player, coords.x, coords.y, coords.z);
            }
        });
}, 20);

function teleportPlayerBelow(player, x, y, z) {
    const blockBelow = player.dimension.getBlock({ x, y: y - 1, z });
    if (blockBelow.typeId === "minecraft:water") {
        player.teleport({ x, y: y - 1, z }, { dimension: player.dimension });
        world.sendMessage(`§l§uOAC§r >§4 ${player.name}§c has detected using Jesus`);
        player.applyDamage(6);
    }
}

world.afterEvents.blockPlace.subscribe(({ block, player, dimension }) => {
    if (!world.scoreboard.getObjective('oac:anti-scaffold-enabled') || player.isOp() || !world.getPlayers({ excludeGameModes: [GameMode.creative], name: player.name }).length) return;

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
const isAttackerOutOfTargetView = (attacker, target) => attacker && target && Math.acos(getNDP(attacker.getViewDirection(), getVector(attacker.location, target.location))) * (180 / Math.PI) > config.antiKillAura.minAngle;

const antiKillAura = (damagingEntity, hitEntity) => {
    if (!damagingEntity.hasTag("pvp-off") && isAttackerOutOfTargetView(damagingEntity, hitEntity)) {
        damagingEntity.addTag("pvp-off");
        world.sendMessage(`§l§uOAC§r >§4 ${damagingEntity.name}§c has detected using Kill Aura!\n§rAngle: ${Math.floor(Math.acos(getNDP(damagingEntity.getViewDirection(), getVector(damagingEntity.location, hitEntity.location))) * (180 / Math.PI))}°)`);
        system.runTimeout(() => damagingEntity.removeTag("pvp-off"), config.antiKillAura.timeout);
    }
};

const antiAutoClicker = (damagingEntity) => {
    const currentTime = Date.now();
    const lastClickTime = cps.get(damagingEntity);

    if (!damagingEntity.hasTag("pvp-off") && lastClickTime && currentTime - lastClickTime < 50 && config.antiAutoClicker.cpsCooldownDuration / (currentTime - lastClickTime) >= config.antiAutoClicker.maxClicksPerSecond) {
        damagingEntity.addTag("pvp-off");
        world.sendMessage(`§l§uOAC§r >§4 ${damagingEntity.name}§c has detected using Auto Clicker!\n§rCPS: ${config.antiAutoClicker.cpsCooldownDuration / (currentTime - lastClickTime)}`);
    }

    cps.set(damagingEntity, currentTime);

    if (cpsCooldown.has(damagingEntity.name)) system.clearRun(cpsCooldown.get(damagingEntity.name));
    cpsCooldown.set(damagingEntity.name, system.runTimeout(() => damagingEntity.removeTag("pvp-off"), config.antiAutoClicker.timeout));
};

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (!(damagingEntity instanceof Player) || damagingEntity.isOp() || !(hitEntity instanceof Player)) return;
    if (world.scoreboard.getObjective('oac:anti-autoclicker-enabled')) antiAutoClicker(damagingEntity);
    if (world.scoreboard.getObjective('oac:anti-killaura-enabled')) antiKillAura(damagingEntity, hitEntity);
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

const checkSpam = (player, behavior) => {
    world.sendMessage(`§4${player.name}§c has detected ${behavior}`);
    player.triggerEvent("run:kick");
};

world.afterEvents.chatSend.subscribe((event) => {
    const { sender: player, message } = event;

    if (!world.scoreboard.getObjective('oac:anti-spam-enabled') || player.isOp()) return;

    if (player.hasTag('five') && player.isOnGround && !player.isJumping) checkSpam(player, "sending messages while moving");
    if (player.hasTag('one') && !player.getEffect("mining_fatigue")) checkSpam(player, "sending messages while swinging their hand");
    if (player.hasTag('two')) checkSpam(player, "sending messages while using an item");

    if (config.blacklistedMessages.some((word) => message.includes(word))) {
        player.triggerEvent("run:kick");
        world.sendMessage(`§4${player.name}§c has been kicked for saying ${message} a blacklisted message`);
        return;
    }

    const currentTime = Date.now();
    const times = lastMessageTimes.get(player.name) || [];
    times.push(currentTime);

    if (times.length > config.antiSpam.maxMessagesPerSecond) times.shift();

    lastMessageTimes.set(player.name, times);

    if (times.length >= config.antiSpam.maxMessagesPerSecond && times[times.length - 1] - times[0] < config.antiSpam.timer) {
        antiSpam(player);
    }
});

function antiSpam(player) {
    const warnings = chatWarnings.get(player.name) || 0;
    chatWarnings.set(player.name, warnings + 1);

    if (warnings + 1 <= config.antiSpam.kickThreshold) {
        player.sendMessage(`§cPlease send messages slowly!\n§8 Warning ${warnings + 1} out of ${config.antiSpam.kickThreshold}`);
    }

    system.runTimeout(() => chatWarnings.delete(player.name), config.antiSpam.timeout);

    if (warnings + 1 > config.antiSpam.kickThreshold) {
        player.triggerEvent("run:kick");
        world.sendMessage(`§4${player.name}§c has been kicked for spamming`);
    }
}

world.beforeEvents.chatSend.subscribe((event) => {
    const { message: message, sender: player } = event;

    if (!world.scoreboard.getObjective('oac:anti-spam-enabled') || player.isOp()) return;

    if (message.length > config.antiSpam.maxCharacterLimit) {
        event.cancel = true;
        player.sendMessage(`§cYour message is too long!\n§8The maximum length is ${config.antiSpam.maxCharacterLimit} characters`);
    } else if (config.chatFilter.some((word) => message.toLowerCase().includes(word))) {
        event.cancel = true;
        player.sendMessage(`§cYour message contains a filtered word`);
    }
});

world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack.typeId !== "minecraft:chorus_fruit" || !event.source.isOp()) return;
    system.run(() => mainMenu(event.source));
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    if (
        world.scoreboard.getObjective('oac:anti-speed-enabled') ||
        world.scoreboard.getObjective('oac:anti-fly-enabled') ||
        world.scoreboard.getObjective('oac:anti-jesus-enabled') ||
        world.scoreboard.getObjective('oac:anti-scaffold-enabled')
    ) {
        playerData.delete(playerId);
    }

    if (
        world.scoreboard.getObjective('oac:anti-autoclicker-enabled') ||
        world.scoreboard.getObjective('oac:anti-killaura-enabled')
    ) {
        [cps, cpsCooldown].forEach(map => map.delete(playerId));
    }

    if (world.scoreboard.getObjective('oac:anti-spam-enabled')) {
        [chatWarnings, lastMessageTimes].forEach(map => map.delete(playerId));
    }
});

system.beforeEvents.watchdogTerminate.subscribe((event) => {
    event.cancel = true;
});
