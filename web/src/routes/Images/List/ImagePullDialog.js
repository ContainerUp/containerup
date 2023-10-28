import {Alert, Box, Dialog, DialogContent, DialogContentText, DialogTitle} from "@mui/material";
import TextField from "@mui/material/TextField";
import {useRef, useState} from "react";
import ImagePullTerminal from "./ImagePullTerminal";
import ImagePullActions from "./ImagePullActions";
import Pipe from "../../../lib/Pipe";

export const demoImage = 'docker.io/library/ubuntu:latest';

export default function ImagePullDialog({open, onClose}) {
    const [imageName, setImageName] = useState('');
    const [pulling, setPulling] = useState(false);
    const done = useRef(false);

    const pullTerminationPipe = new Pipe();
    const pullTerminationOnReceive = pullTerminationPipe.useOnReceive();
    const pullTerminationWriter = pullTerminationPipe.useWriter();

    const handleDialogClose = () => {
        onClose(done.current);
        setImageName('');
        setPulling(false);
    };

    const handleDialogForceClose = () => {
        if (pulling && !done.current) {
            return;
        }
        handleDialogClose();
    };

    const handleDialogConfirm = () => {
        setPulling(true);
    };

    const handlePullFinish = success => {
        if (success) {
            done.current = true;
        }
        pullTerminationWriter();
    };

    const handleClickDemoImage = () => {
        setImageName(demoImage);
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={handleDialogForceClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                disableRestoreFocus
                maxWidth="md"
                fullWidth
            >
                <DialogTitle id="alert-dialog-title">
                    Pull an image
                </DialogTitle>
                <DialogContent
                >
                    {!pulling ? (
                        <>
                            <DialogContentText id="alert-dialog-description">
                                Pull an image from a registry and store it locally.
                            </DialogContentText>
                            <TextField
                                autoFocus
                                margin="dense"
                                label="Repository[:Tag|@Digest]"
                                id="imgname"
                                fullWidth
                                size="small"
                                value={imageName}
                                onChange={event => setImageName(event.target.value)}
                                sx={{marginTop: '12px'}}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        handleDialogConfirm();
                                    }
                                }}
                            />

                            {process.env.REACT_APP_CONTAINERUP_DEMO && (
                                <Alert severity="info">
                                    As a limit of the demo server, please try this one: <b onClick={handleClickDemoImage}>{demoImage}</b>
                                </Alert>
                            )}
                        </>
                    ) : (
                        <>
                            <DialogContentText id="alert-dialog-description">
                            </DialogContentText>
                            <Box
                                sx={{height: '400px'}}
                            >
                                <ImagePullTerminal image={imageName} onFinish={handlePullFinish} />
                            </Box>
                        </>
                    )}

                </DialogContent>
                <ImagePullActions
                    onClose={handleDialogClose}
                    onConfirm={handleDialogConfirm}
                    pulling={pulling}
                    imageName={imageName}
                    pullTerminationOnReceive={pullTerminationOnReceive}
                />
            </Dialog>
        </>
    );
}