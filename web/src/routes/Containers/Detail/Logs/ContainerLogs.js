import {useParams} from "react-router-dom";
import ContainerLogsTerminal from "./ContainerLogsTerminal";
import ContainerLogsSettings from "./ContainerLogsSettings";
import {useState} from "react";
import Pipe from "../../../../lib/Pipe";

export default function ContainerLogs() {
    const {containerId} = useParams();
    const [logOpts, setLogOpts] = useState({
        follow: false,
        tail: true,
        tailNum: 200
    });

    const wsTerminationPipe = new Pipe();
    const wsTerminationOnReceive = wsTerminationPipe.useOnReceive();
    const wsTerminationWriter = wsTerminationPipe.useWriter();

    const stopActionPipe = new Pipe();
    const stopActionOnReceive = stopActionPipe.useOnReceive();
    const stopActionWriter = stopActionPipe.useWriter();

    const handleRefresh = opts => {
        setLogOpts(opts);
    };

    return (
        <>
            <ContainerLogsSettings
                logOpts={logOpts}
                onRefresh={handleRefresh}
                wsTerminationOnReceive={wsTerminationOnReceive}
                stopActionWriter={stopActionWriter}
            />

            <ContainerLogsTerminal
                containerId={containerId}
                logOpts={logOpts}
                wsTerminationWriter={wsTerminationWriter}
                stopActionOnReceive={stopActionOnReceive}
            />
        </>
    );
}