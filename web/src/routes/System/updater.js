import dataModel from "../../lib/dataModel";
import term from "../../lib/termUtil";

export default async function DoUpdate(writer, image, skipPulling, ab) {
    writer({type: 'data', data: term.reset + term.green('Step 1: Performing pre-update check...') + term.crlf});
    await check(ab);
    writer({type: 'data', data: term.green('Check passed.') + term.crlf});

    writer({type: 'data', data: term.crlf + term.green('Step 2: Pulling new image...') + term.crlf});
    if (!skipPulling) {
        await pullImage(writer, image, ab);
        writer({type: 'data', data: term.green('Image pulled successfully.') + term.crlf});
    } else {
        writer({type: 'data', data: term.yellow('Skipped.') + term.crlf});
    }

    writer({type: 'data', data: term.crlf + term.green('Step 3: Starting the updater container...') + term.crlf});
    await startUpdater(image, ab);
    writer({type: 'data', data: term.green('Updater container started.') + term.crlf});

    writer({type: 'data', data: term.crlf + term.green('Step 4: Waiting for ContainerUp to be live again...') + term.crlf});
    return await waitLive(writer, ab);
}

function check(ab) {
    return dataModel.systemUpdatePreCheck(ab)
        .then(data => {
            if (!data.ok) {
                throw new Error(data.message);
            }
        })
        .catch(error => {
            if (error.response) {
                if (error.response.status === 401) {
                    throw new Error('Session expired. Reload the page and try again.');
                }
            }
            throw error;
        });
}

function pullImage(writer, image, ab) {
    const [pullPromise, cancelFunc] = dataModel.imagePull(image);

    return new Promise((resolve, reject) => {
        if (ab.signal.aborted) {
            reject(ab.signal.reason);
        }

        let terminated = false;
        let closer = cancelFunc;
        let pulledImageId = '';

        ab.signal.addEventListener('abort', () => {
            terminated = true;
            closer();
            reject(ab.signal.reason);
        });

        pullPromise
            .then(({onReceive, onClose, close}) => {
                onReceive(d => {
                    switch (d[0]) {
                        case "0": {
                            writer({type: 'data', data: d.substring(1).replaceAll('\n', '\r\n')});
                            break;
                        }
                        case "e": {
                            const reason = d.substring(1).replaceAll('\n', '\r\n');
                            reject(reason);
                            break;
                        }
                        case "s": {
                            pulledImageId = d.substring(1);
                            break;
                        }
                        default: {
                            // noop
                        }
                    }
                });

                onClose(({code, reason}) => {
                    if (code === 4001) {
                        reject('Session expired. Reload the page and try again.');
                        return;
                    }

                    if (!terminated) {
                        if (code === 1000) {
                            resolve(pulledImageId);
                        } else {
                            reject(reason);
                        }
                    }
                });

                closer = close;
        })
            .catch(error => {
                reject(error);
            });
    });
}

function startUpdater(image, ab) {
    return dataModel.systemUpdateAction(image, ab)
        .catch(error => {
            if (error.response) {
                throw new Error(error.response.data);
            }
        });
}

function waitLive(writer, ab) {
    let timeout = null;
    let count = 0;

    return new Promise((resolve, reject) => {
        ab.signal.addEventListener('abort', () => {
            if (timeout) {
                clearTimeout(timeout);
            }
            reject(ab.signal.reason);
        });

        const ping = () => {
            timeout = null;
            writer({type: 'data', data: 'Try to ping ContainerUp...' + term.crlf});
            dataModel.ping(ab)
                .then(data => {
                    writer({type: 'data', data: term.green('ContainerUp is live now.') + term.crlf});
                    resolve(data);
                })
                .catch(error => {
                    let comment = '';
                    if (error.response) {
                        comment = ` (${error.response.status})`;
                    }
                    writer({type: 'data', data: 'ContainerUp is not live yet.' + comment + term.crlf});
                    count ++;
                    if (count > 9) {
                        reject(new UpdateFatalError('ContainerUp is still not alive after 10 retries. Sorry, but you have to troubleshoot on the server.'));
                        return;
                    }
                    timeout = setTimeout(() => ping(), 2000);
                });
        };

        timeout = setTimeout(() => ping(), 2000);
    });
}

export class UpdateFatalError extends Error {
}
