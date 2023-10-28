import dataModel from "./dataModel";

const makeAioConnection = (onData, onOpen, onError, onClose) => {
    const [loginKey, prefix] = dataModel.getLoginKeyAndPrefix();

    let protocol = 'ws:';
    if (window.location.protocol === 'https:') {
        protocol = 'wss:';
    }
    let url = protocol + '//' + window.location.host + prefix + '/subscribe';

    const ws = new WebSocket(url);

    // 0 connecting, 1 connected, 99 error and closed
    let state = 0;

    ws.addEventListener('message', event => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            state = 99;
            onError(new Error('Websocket invalid message: ' + e.toString()));
            ws.close(4500);
            return;
        }

        onData(data);
    });
    ws.addEventListener('open', () => {
        if (state !== 0) {
            return;
        }
        ws.send(loginKey);
        state = 1;

        onOpen();
    });
    ws.addEventListener('error', () => {
        if (state === 99) {
            return;
        }
        ws.close();
        state = 99;

        onError(new WebsocketError('Cannot connect to websocket', websocketErrorTypeConnect));
    });
    ws.addEventListener('close', event => {
        if (state === 99) {
            return;
        }
        const {code, reason} = event;
        ws.close();

        state = 99;
        let err;
        if (code === 4001) {
            err = dataModel.errors.errNoLogin;
        } else {
            err = new WebsocketError(`Websocket closed ${code} ${reason}`, websocketErrorTypeDisconnect);
        }
        onClose(err);
    });

    return [d => {
        ws.send(JSON.stringify(d));
    }, (code = 1000, reason = '') => {
        ws.close(code, reason);
    }];
};

const aioMain = onAioClose => {
    const reqQueue = {};
    const subscribers = {};
    let nextIndex = 0;

    let sentClosure = false;
    const broadcastClosure = error => {
        if (sentClosure) {
            return;
        }

        // reqQueue
        Object.keys(reqQueue).forEach(index => {
            reqQueue[index].onError(error);
            delete reqQueue[index];
        });

        // subscribers
        Object.keys(subscribers).forEach(index => {
            subscribers[index].onError(error);
            delete subscribers[index];
        });
    };

    const onData = data => {
        const sub = subscribers[data.index];
        if (!sub) {
            // not found
            return;
        }
        if (data.error) {
            sub.onError(data.data);
            delete subscribers[data.index];
            return;
        }
        sub.onData(data.data);
    };

    let ready = false;
    const onOpen = () => {
        Object.keys(reqQueue).forEach(index => {
            const req = reqQueue[index];
            subscribers[index] = {onData: req.onData, onError: req.onError};
            req.fnSub(index, req.arg);
            delete reqQueue[index];
        });
        ready = true;
    };

    let closed = false;
    const onError = e => {
        broadcastClosure(e);
        if (!closed) {
            onAioClose();
        }
        closed = true;
    };

    const onClose = e => {
        broadcastClosure(e);
        if (!closed) {
            onAioClose();
        }
        closed = true;
    };

    const [writer, closer] = makeAioConnection(onData, onOpen, onError, onClose);

    const commonSubscribe = (fnSub, fnUnsub, onData, onError, arg = undefined)  => {
        const index = nextIndex;
        nextIndex += 1;

        clearTimeout(disconnectTimeout);
        if (!ready) {
            reqQueue[index] = {fnSub, onData, onError, arg};
            return () => commonUnsubscribe(index, fnUnsub);
        }
        if (closed) {
            onError(new WebsocketError('connection closed', websocketErrorTypeDisconnect));
            return () => {};
        }

        subscribers[index] = {onData, onError};
        fnSub(index, arg);

        return () => commonUnsubscribe(index, fnUnsub);
    };

    const commonUnsubscribe = (index, fnUnsub) => {
        if (!reqQueue[index] && !subscribers[index]) {
            // no need to send
            return;
        }

        if (ready && !closed) {
            // new index, we don't need the resp actually
            const newIndex = nextIndex;
            nextIndex += 1;
            fnUnsub(newIndex, index);
        }
        delete subscribers[index];
        delete reqQueue[index];
        disconnecter();
    };

    let disconnectTimeout;
    const disconnecter = () => {
        if (Object.keys(subscribers).length === 0 && Object.keys(reqQueue).length === 0) {
            clearTimeout(disconnectTimeout);
            disconnectTimeout = setTimeout(() => {
                closer(1000);
                onAioClose();
            }, 1000 * 15);
        } else {
            clearTimeout(disconnectTimeout);
        }
    };

    const _subContainersList = index => {
        writer({index: parseInt(index), action: 'subscribeToContainersList'});
    };

    const _unsubContainersList = (index, oldIndex) => {
        writer({index: index, action: 'unsubscribeToContainersList', data: oldIndex});
    };

    const _subContainer = (index, id) => {
        writer({index: parseInt(index), action: 'subscribeToContainer', data: id});
    };

    const _unsubContainer = (index, oldIndex) => {
        writer({index: index, action: 'unsubscribeToContainer', data: oldIndex});
    };

    const _subImagesList = index => {
        writer({index: parseInt(index), action: 'subscribeToImagesList'});
    };

    const _unsubImagesList = (index, oldIndex) => {
        writer({index: index, action: 'unsubscribeToImagesList', data: oldIndex});
    };

    const _subContainersStat = (index, id) => {
        writer({index: parseInt(index), action: 'subscribeToContainerStats', data: id});
    };

    const _unsubContainersStat = (index, oldIndex) => {
        writer({index: index, action: 'unsubscribeToContainerStats', data: oldIndex});
    };

    const _subSysStat = (index, id) => {
        writer({index: parseInt(index), action: 'subscribeToSystemStats', data: id});
    };

    const _unsubSysStat = (index, oldIndex) => {
        writer({index: index, action: 'unsubscribeToSystemStats', data: oldIndex});
    };

    return {
        containersList: (onData, onError) => commonSubscribe(_subContainersList, _unsubContainersList, onData, onError),
        container: (id, onData, onError) => commonSubscribe(_subContainer, _unsubContainer, onData, onError, id),
        imagesList: (onData, onError) => commonSubscribe(_subImagesList, _unsubImagesList, onData, onError),
        containerStatistics: (id, onData, onError) => commonSubscribe(_subContainersStat, _unsubContainersStat, onData, onError, id),
        systemStats: (onData, onError) => commonSubscribe(_subSysStat, _unsubSysStat, onData, onError),
    };
};

let aio = null;

export function aioProvider() {
    if (aio) {
        return aio;
    }

    aio = aioMain(() => {
        aio = null;
    });
    return aio;
}

class WebsocketError extends Error {
    constructor(message, type) {
        super(message);
        this.name = this.constructor.name;
        this.errType = type;
    }
}

const websocketErrorTypeDisconnect = 'disconnect';
const websocketErrorTypeConnect = 'connect';

export function isDisconnectError(err) {
    if (!(err instanceof WebsocketError)) {
        return false;
    }
    return err.errType === websocketErrorTypeDisconnect;
}

export function isConnectError(err) {
    if (!(err instanceof WebsocketError)) {
        return false;
    }
    return err.errType === websocketErrorTypeConnect;
}
