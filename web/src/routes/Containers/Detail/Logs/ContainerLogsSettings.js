import {Button, Checkbox, FormControlLabel, Stack} from "@mui/material";
import TextField from "@mui/material/TextField";
import {useState} from "react";
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';

export default function ContainerLogsSettings({logOpts, onRefresh, wsTerminationOnReceive, stopActionWriter}) {
    const [followChecked, setFollowChecked] = useState(logOpts.follow);
    const [tailChecked, setTailChecked] = useState(logOpts.tail);
    const [tailNum, setTailNum] = useState(logOpts.tailNum);
    const [live, setLive] = useState(true);

    wsTerminationOnReceive(() => {
        setLive(false);
    });

    const handleFollowCheck = event => {
        setFollowChecked(event.target.checked);
    };

    const handleTailCheck = event => {
        setTailChecked(event.target.checked);
    };

    const handleNumChange = event => {
        setTailNum(event.target.value);
    };

    const handleRefreshClick = () => {
        setLive(true);
        if (onRefresh) {
            onRefresh({
                follow: followChecked,
                tail: tailChecked,
                tailNum: tailNum
            });
        }
    };

    const handleStopClick = () => {
        if (stopActionWriter) {
            stopActionWriter();
        }
    };

    return (
        <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={1}
            sx={{marginBottom: '8px'}}
        >

            <FormControlLabel
                control={<Checkbox
                    checked={followChecked}
                    onChange={handleFollowCheck}
                />}
                label="Follow"
                disabled={live}
            />

            <FormControlLabel
                control={<Checkbox
                    checked={tailChecked}
                    onChange={handleTailCheck}
                />}
                label="Tail lines"
                disabled={live}
            />
            <TextField
                hiddenLabel
                type="number"
                variant="filled"
                size="small"
                value={tailNum}
                disabled={!tailChecked || live}
                onChange={handleNumChange}
                InputLabelProps={{
                    shrink: true,
                }}
                sx={{width: '100px'}}
            />

            {live && (
                <>
                    {followChecked && (
                        <Button variant="contained" startIcon={<StopIcon />} color="warning" onClick={handleStopClick}>
                            <span style={{width: '60px'}}>
                                Stop
                            </span>
                        </Button>
                    )}

                    {!followChecked && (
                        <Button variant="contained" startIcon={<RefreshIcon />} onClick={handleRefreshClick} disabled>
                            <span style={{width: '60px'}}>
                                Refresh
                            </span>
                        </Button>
                    )}
                </>
            )}

            {!live && (
                <Button variant="contained" startIcon={<RefreshIcon />} onClick={handleRefreshClick}>
                    <span style={{width: '60px'}}>
                        Refresh
                    </span>
                </Button>
            )}

        </Stack>
    );
}