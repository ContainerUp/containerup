import MyTerminalTwoWay from "../../../components/MyTerminalTwoWay";
import TwoWayPipe from "../../../lib/TwoWayPipe";
import {useCallback, useEffect} from "react";
import dataModel from "../../../lib/dataModel";
import term from "../../../lib/termUtil";

export default function ImagePullTerminal({image, onFinish}) {
    const dataPipe = new TwoWayPipe();
    const xtSide = dataPipe.useLeft();

    const pullImage = useCallback((imageName) => {
        const xtWriter = xtSide.useWriter();

        xtWriter({type: 'data', data: term.reset + term.yellow('Connecting...')});

        const [promise, cancelFunc] = dataModel.imagePull(imageName);

        let terminated = false;
        let cancel = false;
        let pulledImageId = '';

        let terminalCloser = () => {
            cancel = true;
            cancelFunc();
        };

        promise.then(handle => {
            xtWriter({type: 'data', data: term.reset});

            handle.onReceive(d => {
                switch (d[0]) {
                    case "0": {
                        xtWriter({type: 'data', data: d.substring(1).replaceAll('\n', '\r\n')});
                        break;
                    }
                    case "e": {
                        const reason = d.substring(1).replaceAll('\n', '\r\n');
                        xtWriter({type: 'data', data: term.red(`Error occurred: ${reason}.`)});
                        terminated = true;
                        break;
                    }
                    case "s": {
                        pulledImageId = d.substring(1);
                        break;
                    }
                    default: {
                        console.log('unknown data', d);
                    }
                }
            });

            handle.onClose(({code, reason}) => {
                if (code === 4001) {
                    xtWriter({type: 'data', data: term.red(`Session expired. Reload the page and try again.`)});
                    onFinish(false);
                    return;
                }

                if (!terminated) {
                    if (code === 1000) {
                        xtWriter({type: 'data', data: term.green('Image pulled successfully.')});
                        onFinish(true, pulledImageId);
                    } else {
                        xtWriter({type: 'data', data: term.red(`Error occurred: ${reason}.`)});
                        onFinish(false);
                    }
                } else {
                    onFinish(false);
                }
            });

            terminalCloser = () => handle.close();
        }).catch(error => {
            if (cancel) {
                return;
            }
            const e = error.toString();
            xtWriter({type: 'data', data: term.reset + term.red(`Cannot execute command: ${e}.`)});
            onFinish(false);
            // console.log('catch', error)
        });

        // closer
        return () => terminalCloser();
    }, [onFinish, xtSide]);

    useEffect(() => {
        const closer = pullImage(image);
        return () => closer();
    }, [image, pullImage]);

    return (
        <MyTerminalTwoWay
            dataSide={dataPipe.useRight()}
        />
    );
}