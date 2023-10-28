import {useState} from "react";
import {Button, Checkbox, FormControlLabel, Stack} from "@mui/material";
import TextField from "@mui/material/TextField";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

export default function ContainerExecOptions({execOpts, onExec, stopPipeSide}) {
    const [live, setLive] = useState(false);
    const [cmd, setCmd] = useState(execOpts.cmd);
    const [tty, setTty] = useState(execOpts.tty);
    const [interactive, setInteractive] = useState(execOpts.interactive);

    const onReceiveShellStop = stopPipeSide.useOnReceive();
    onReceiveShellStop(() => {
        setLive(false);
    });

    const handleSubmit = event => {
        event.preventDefault();
        setLive(true);
        if (onExec) {
            onExec({
                interactive,
                tty,
                cmd
            });
        }
    };

    const handleTtyChange = event => {
        setTty(event.target.checked);
    };

    const handleInteractiveChange = event => {
        setInteractive(event.target.checked);
    };

    const handleCmdChange = event => {
        setCmd(event.target.value);
    };

    const stopWriter = stopPipeSide.useWriter();
    const handleStop = () => {
        setLive(false);
        stopWriter();
    };

    return (
        <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={1}
            sx={{marginBottom: '8px'}}
            component="form"
            onSubmit={handleSubmit}
        >

            <FormControlLabel
                control={<Checkbox
                    checked={interactive}
                    onChange={handleInteractiveChange}
                />}
                label="Interactive"
                disabled={live}
            />

            <FormControlLabel
                control={<Checkbox
                    checked={tty}
                    onChange={handleTtyChange}
                />}
                label="TTY"
                disabled={live}
            />

            <TextField
                hiddenLabel
                label="Command"
                required
                size="small"
                value={cmd}
                onChange={handleCmdChange}
                disabled={live}
                sx={{width: '300px', marginLeft: '16px !important'}}
            />

            {live && (
                <Button variant="contained" startIcon={<StopIcon />} color="warning" onClick={handleStop}>
                            <span style={{width: '60px'}}>
                                Stop
                            </span>
                </Button>
            )}

            {!live && (
                <Button variant="contained" startIcon={<PlayArrowIcon />} type="submit">
                    <span style={{width: '60px'}}>
                        Execute
                    </span>
                </Button>
            )}

        </Stack>
    );
}