/* eslint-disable @typescript-eslint/no-explicit-any */
import * as pino from 'pino';

export default class Logger {

    pino: pino.Logger<never>

    constructor(name: string, destination: pino.DestinationStream | undefined = undefined) {
        this.pino = pino.default(
            {
                level: process.env.NODE_ENV === 'test'  ? 'silent' : 'info',
                base: {name},
                timestamp: pino.stdTimeFunctions.isoTime,
                formatters: { level: (label) => { return { level: label }; } },
                hooks: {
                    logMethod(inputArgs, method) {
                        if (inputArgs.length == 2) {
                            const msg = inputArgs.shift() as string | undefined;
                            const context = inputArgs.shift();

                            if (context instanceof Object) {
                                return method.apply(this, [context, msg])
                            }
                            return method.apply(this, [{context}, msg])
                        }
                        if (inputArgs.length > 2) {
                            const msg = inputArgs.shift() as string | undefined;
                            return method.apply(this, [{context: inputArgs}, msg])
                        }
                        return method.apply(this, inputArgs);
                    }
                },
            },
            destination
        )
    }

    debug(...args: any[]) {
        return this.pino.debug(args);
    }

    log(...args: any[]) {
        return this.pino.info(args);
    }

    info(...args: any[]) {
        return this.pino.info(args);
    }

    warn(...args: any[]) {
        return this.pino.warn(args);
    }

    error(...args: any[]) {
        return this.pino.error(args);
    }
}
