import arcjet, {shield, detectBot, slidingWindow} from "@arcjet/node";

const isProduction = process.env.NODE_ENV === 'production';

const aj = arcjet({

    key: process.env.ARCJET_KEY,
    rules: [
        shield({mode: "LIVE"}),
        detectBot({
            mode: isProduction ? "LIVE" : "DRY_RUN",
            allow: [
                "CATEGORY:SEARCH_ENGINE",
                "CATEGORY:PREVIEW",
            ],
        }),
        slidingWindow({
            mode: "LIVE",
            interval: isProduction ? '2s' : '10s',
            max: isProduction ? 5 : 3
        })
    ],
});

export default aj;
