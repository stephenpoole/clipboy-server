import { Twitch } from './twitch';
import { isCelebrate } from 'celebrate';
import { routes } from './routes';
import {
    PORT,
    TWITCH_CLIENT_SECRET,
    TWITCH_CLIENT_ID,
    HOST,
    ENVIRONMENT,
    SSL_KEY_PATH,
    SSL_CERT_PATH,
    FORCE_HTTP,
    BEARER_TOKEN
} from './config';

if (typeof BEARER_TOKEN === 'undefined') {
    throw new Error('BEARER_TOKEN cannot be undefined');
}

const fs = require('fs');
const https = require('https');
const rateLimit = require('express-rate-limit');
const express = require('express');
const bodyparser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const api = express();

export const server = async () => {
    api.use(helmet());
    if (ENVIRONMENT === 'production') {
        api.use(
            rateLimit({
                windowMs: 60 * 1000,
                max: 2,
                handler: (req, res) => {
                    res.status(429).json({
                        status: 'error',
                        error: 'error.network.toomany'
                    });
                }
            })
        );
    } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    }
    api.use(
        cors({
            origin: (origin, callback) => {
                const regex = new RegExp(`^https?:\/\/(${HOST})(:|\/)?`, 'g');
                const result = regex.exec(origin);

                if (
                    (result && result.length > 0) ||
                    (ENVIRONMENT === 'development' && !origin) ||
                    origin === 'null'
                ) {
                    callback(null, true);
                    return;
                }
                callback(new Error('error.network.forbidden'));
            }
        })
    );
    api.use(bodyparser.json());
    api.use((error, req, res, next) => {
        res.xml = xmlHandler.bind(xmlHandler, req, res);
        next(error);
    });
    routes(api);
    api.use((error, req, res, next) => {
        if (isCelebrate(error)) {
            const [{ type, path = [] }] = error.joi.details;
            const field = path.join('.').toLowerCase();
            res.status(400).json({ status: 'error', error: `error.${field}.${type}` });
        } else if (error) {
            res.status(500).json({ status: 'error', error: error.message });
        } else {
            next(error);
        }
    });
    api.all('*', (req, res) => {
        res.status(404).json({ status: 'error' });
    });

    await Twitch.init({ clientId: TWITCH_CLIENT_ID, clientSecret: TWITCH_CLIENT_SECRET });
    if (FORCE_HTTP === 'true') {
        api.listen(PORT || 3000, () =>
            console.log(`app listening on port ${PORT || 3000} in http mode`)
        );
    } else {
        https
            .createServer(
                {
                    key: fs.readFileSync(SSL_KEY_PATH),
                    cert: fs.readFileSync(SSL_CERT_PATH)
                },
                api
            )
            .listen(PORT || 3000, () =>
                console.log(`app listening on port ${PORT || 3000} in https mode`)
            );
    }
};
