import Pipe from "./Pipe";

const errWebsocket = new Error('cannot connect websocket');

export function receiveOnlyWebsocket(url, loginKey) {
    const ws = new WebSocket(url);
    const canceler = () => ws.close(1000, 'canceled');

    return [new Promise((resolve, reject) => {
        const msgPipe = new Pipe();
        const msgWriter = msgPipe.useWriter();

        const closePipe = new Pipe();
        let closeNotified = false;
        const closeWriter = d => {
            if (closeNotified) {
                return;
            }

            const closeWriter = closePipe.useWriter();
            closeWriter(d);
        };

        let open = false;
        let errClosed = false;
        ws.addEventListener('message', event => {
            msgWriter(event.data);
        });
        ws.addEventListener('open', () => {
            ws.send(loginKey);

            open = true;
            resolve({
                onReceive: msgPipe.useOnReceive(),
                onClose: closePipe.useOnReceive(),
                close: () => {
                    // console.log('dm: ws close now')
                    ws.close(1000, 'user terminated the session');
                }
            });
        });
        ws.addEventListener('error', () => {
            if (!open) {
                reject(errWebsocket);
                return;
            }
            ws.close();
            closeWriter({code: -1, reason: 'websocket error'});
            errClosed = true;
        });
        ws.addEventListener('close', event => {
            if (errClosed) {
                return;
            }
            const {code, reason} = event;
            ws.close();
            closeWriter({code, reason});
        });
    }), canceler];
}
