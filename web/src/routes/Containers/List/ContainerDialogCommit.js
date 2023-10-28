import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle
} from "@mui/material";
import {useCallback, useEffect, useState} from "react";
import TextField from "@mui/material/TextField";
import dataModel from "../../../lib/dataModel";
import {useNavigate} from "react-router-dom";
import {enqueueSnackbar} from "notistack";

export default function ContainerDialogCommit({open, containerName, containerIdShort, onClose}) {
    const navigate = useNavigate();
    const [actioning, setActioning] = useState(false);
    const [tag, setTag] = useState('');
    const [submitTimes, setSubmitTimes] = useState(0);

    const handleDialogClose = useCallback(() => {
        setTag('');
        onClose();
    }, [onClose]);

    const handleDialogForceClose = () => {
        if (actioning) {
            return;
        }
        handleDialogClose();
    };

    const handleDialogConfirm = () => {
        if (!tag) {
            setSubmitTimes(v => v + 1);
            return;
        }
        setSubmitTimes(0);
        setActioning(true);
    };

    useEffect(() => {
        if (!actioning) {
            return;
        }

        const ac = new AbortController();
        dataModel.containerAction(containerIdShort, {
            action: 'commit',
            repoTag: tag
        }, ac)
            .then(() => {
                handleDialogClose();
                const msg = (<span>
                    Container <b>{containerName}</b> ({containerIdShort}) has been committed to image <b>{tag}</b>.
                </span>);
                enqueueSnackbar(msg, {
                    variant: 'success'
                });
            })
            .catch(err => {
                if (ac.signal.aborted) {
                    return;
                }
                if (dataModel.errIsNoLogin(err)) {
                    let query = new URLSearchParams();
                    query.append('cb', '/containers');
                    navigate('/login?' + query.toString());
                    return;
                }
                let errStr = err.toString();
                if (err.response) {
                    errStr = err.response.data;
                }
                enqueueSnackbar(errStr, {
                    variant: 'error'
                });
            })
            .finally(() => {
                if (ac.signal.aborted) {
                    return;
                }
                setActioning(false);
            });

        return () => ac.abort();
    }, [actioning, containerName, containerIdShort, handleDialogClose, navigate, tag]);

    return (
        <>
            <Dialog
                open={open}
                onClose={handleDialogForceClose}
                aria-labelledby="alert-dialog-title-commit"
                aria-describedby="alert-dialog-description-commit"
                disableRestoreFocus
            >
                <DialogTitle id="alert-dialog-title-commit">
                    Commit container
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description-commit">
                        Commit the container <b>{containerName}</b> ({containerIdShort}) to an image.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Repository[:Tag]"
                        fullWidth
                        size="small"
                        value={tag}
                        onChange={event => setTag(event.target.value)}
                        sx={{marginTop: '12px'}}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                handleDialogConfirm();
                            }
                        }}
                        disabled={actioning}
                        error={submitTimes > 0 && tag === ''}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} disabled={actioning}>
                        Cancel
                    </Button>
                    <Button onClick={handleDialogConfirm} disabled={actioning}>
                        Commit
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
