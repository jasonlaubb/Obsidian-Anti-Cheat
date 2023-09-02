const config = {

    antiAutoClicker: {
        maxClicksPerSecond: 22,
        timeout: 400 // 10 seconds = 400 ticks, pvp-off tag will be removed after 5 seconds
    },

    antiKillAura: {
        minAngle: 90, // 90 degrees
        timeout: 400 // 10 seconds = 400 ticks, pvp-off tag will be removed after 10 seconds
    },

    antiFly: {
        maxAirTime: 4000 // 4 seconds = 4000 milliseconds
    },

    antiSpeed: {
        mphThreshold: 150, // Greater than 150 mph
    },

    antiScaffold: {
        maxPlacementsPerSecond: 5, // 5 blocks per second
        timer: 500 // 0.5 seconds = 500 milliseconds
    },

    antiSpam: {
        maxMessagesPerSecond: 3, // 3 messages per second
        timer: 500, // 0.5 seconds = 500 milliseconds
        maxCharacterLimit: 200, // max character limit per message
        kickThreshold: 3, // warn the player 3 times before kicking them
        timeout: 200 // 5 seconds = 200 ticks
    },

    chatFilter: [
// add words here that you want to be filtered in the chat, it cancels the message if it contains any of the words
        "niger",
        "gay",
        "kill yourself"
    ],

    blacklistedMessages: [
// add words here that you want to kick the player if they say it in the chat that contains any of the words
        "discord.gg",
        "dsc.gg",
        "@outlook.com",
        "@gmail.com",
        "@hotmail.com",
        "discordapp.com",
        "https://",
        "http://",
        "the best minecraft bedrock utility mod",
        "disepi/ambrosial"
    ]
};

export default config;
