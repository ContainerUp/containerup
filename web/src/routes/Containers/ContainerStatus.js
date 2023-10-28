import {Box, Tooltip} from "@mui/material";
import {green, red, yellow} from "@mui/material/colors";
import timeUtil from "../../lib/timeUtil";
import {useEffect, useState} from "react";

export default function ContainerStatus({state, exitCode, exitAt, startedAt}) {
    const [version, setVersion] = useState(0);

    let exitDate = exitAt;
    if (typeof exitAt === 'number') {
        exitDate = new Date(exitAt * 1000);
    }
    const [exitAgo, nextRefreshExitAgo] = timeUtil.dateAgo(exitDate);

    let startDate = startedAt;
    if (typeof startedAt === 'number') {
        startDate = new Date(startedAt * 1000);
    }
    const [startAgo, nextRefreshStartAgo] = timeUtil.dateAgo(startDate);

    useEffect(() => {
        if (state === 'running') {
            if (nextRefreshStartAgo < 0) {
                return;
            }
            const timeout = setTimeout(() => {
                setVersion(v => v + 1);
            }, nextRefreshStartAgo * 1000);
            return () => clearTimeout(timeout);
        }
        if (state === 'exited') {
            if (nextRefreshExitAgo < 0) {
                return;
            }
            const timeout = setTimeout(() => {
                setVersion(v => v + 1);
            }, nextRefreshExitAgo * 1000);
            return () => clearTimeout(timeout);
        }
    });
    // always run this logic, so there is no dependency

    switch (state) {
        case 'running': {
            return (
                <Box sx={{color: green[500]}} key={version}>
                    <Tooltip title={startDate.toLocaleString()}>
                        <div style={{display: 'flex', flexWrap: 'wrap'}}>
                            <div>Up&nbsp;</div>
                            <div>{startAgo}</div>
                        </div>
                    </Tooltip>
                </Box>
            );
        }
        case 'exited': {
            return (
                <Box sx={{color: red[500]}} key={version}>
                    <Tooltip title={exitDate.toLocaleString()}>
                        <div style={{display: 'flex', flexWrap: 'wrap'}}>
                            <div>Exited ({exitCode})&nbsp;</div>
                            <div>{exitAgo}</div>
                        </div>
                    </Tooltip>
                </Box>
            );
        }
        case 'created': {
            return (
                <Box sx={{color: yellow[900]}}>
                    Created
                </Box>
            );
        }
        case 'paused': {
            return (
                <Box sx={{color: yellow[900]}}>
                    Paused
                </Box>
            );
        }
        default:
            return state;
    }
}