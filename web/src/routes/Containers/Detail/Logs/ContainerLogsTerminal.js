import {useCallback, useEffect} from "react";
import dataModel from "../../../../lib/dataModel";
import {useNavigate} from "react-router-dom";
import {Box} from "@mui/material";

import term from "../../../../lib/termUtil";
import TwoWayPipe from "../../../../lib/TwoWayPipe";
import MyTerminalTwoWay from "../../../../components/MyTerminalTwoWay";

export default function ContainerLogsTerminal({containerId, logOpts, wsTerminationWriter, stopActionOnReceive}) {
    const navigate = useNavigate();

    const dataPipe = new TwoWayPipe();
    const leftSide = dataPipe.useLeft();
    const leftWriter = leftSide.useWriter();

    const connectLogs = useCallback((containerId, logOpts, writer) => {
        writer({
            type: 'data',
            data: term.reset + term.yellow('Connecting...')
        });

        const [promise, cancelFunc] = dataModel.containerLogs(containerId, logOpts);

        let cancel = false;
        let terminated = false;
        let terminalCloser = () => {
            cancel = true;
            cancelFunc();
        };

        promise.then(handle => {
            // console.log("Log open...")
            writer({
                type: 'data',
                data: term.reset
            });

            handle.onReceive(d => {
                // 0 (std out) + data...
                // 1 (std err) + data...
                writer({
                    type: 'data',
                    data: d.substring(1).replaceAll('\n', '\r\n')
                });
            });

            handle.onClose(({code, reason}) => {
                if (code === 4001) {
                    let query = new URLSearchParams();
                    query.append('cb', '/containers/' + containerId + '/logs');
                    navigate('/login?' + query.toString());
                    return;
                }

                const now = new Date().toLocaleString();
                if (!terminated) {
                    writer({
                        type: 'data',
                        data: term.crlf + term.red(`Session ended at ${now}.`)
                    });
                    if (code !== 1000) {
                        let reasonStr = '';
                        if (reason) {
                            reasonStr = `: ${reason}`;
                        }
                        writer({
                            type: 'data',
                            data: term.red(` (Abnormally${reasonStr})`)
                        });
                    }
                }

                if (wsTerminationWriter) {
                    wsTerminationWriter();
                }
                // console.log('Log close', code, reason);
            });

            terminalCloser = () => handle.close();
        }).catch(error => {
            if (cancel) {
                return;
            }
            const e = error.toString();
            writer({
                type: 'data',
                data: term.reset + term.red(`Cannot load logs: ${e}.`)
            });
            if (wsTerminationWriter) {
                wsTerminationWriter();
            }
            // console.log('catch', error)
        });

        if (stopActionOnReceive) {
            stopActionOnReceive(() => {
                terminated = true;
                terminalCloser();
                const now = new Date().toLocaleString();
                writer({
                    type: 'data',
                    data: term.crlf + term.red(`Session ended by user at ${now}.`)
                });
            });
        }

        // closer
        return () => terminalCloser();
    }, [navigate, wsTerminationWriter, stopActionOnReceive]);


    useEffect(() => {
        const closer = connectLogs(containerId, logOpts, leftWriter);
        return () => closer();
    }, [connectLogs, logOpts, containerId, leftWriter]);

    return (
        <Box sx={{height: 'calc(100vh - 214px)'}}>
            <MyTerminalTwoWay dataSide={dataPipe.useRight()} />
        </Box>
    );
}