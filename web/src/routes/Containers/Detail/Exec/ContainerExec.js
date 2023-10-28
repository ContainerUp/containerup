import ContainerExecOptions from "./ContainerExecOptions";
import {useState} from "react";
import {useParams} from "react-router-dom";
import {getTwoWayPipeSides} from "../../../../lib/TwoWayPipe";
import ContainerExecTerminal from "./ContainerExecTerminal";

export default function ContainerExec() {
    const {containerId} = useParams();
    const [execOpts, setExecOpts] = useState({
        interactive: true,
        tty: true,
        cmd: 'bash'
    });

    const [start, setStart] = useState(false);

    const [settingSide, terminalSide] = getTwoWayPipeSides();

    const handleExec = opts => {
        setExecOpts(opts);
        setStart(true);
    };

    return (
        <>
            <ContainerExecOptions
                execOpts={execOpts}
                onExec={handleExec}
                stopPipeSide={settingSide}
            />
            <ContainerExecTerminal
                containerId={containerId}
                execOpts={execOpts}
                stopPipeSide={terminalSide}
                start={start}
            />
        </>
    );
}