import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from "@mui/material";
import {useEffect, useState} from "react";
import dataModel from "../../../lib/dataModel";
import {useNavigate} from "react-router-dom";
import {enqueueSnackbar} from "notistack";

export default function ImageDialogRemove({open, image, onClose}) {
    const navigate = useNavigate();
    const [actioning, setActioning] = useState(false);

    const handleDialogClose = () => {
        onClose();
    };

    const handleDialogForceClose = () => {
        if (actioning) {
            return;
        }
        handleDialogClose();
    };

    const handleDialogConfirm = () => {
        setActioning(true);
    };

    useEffect(() => {
        if (!actioning) {
            return;
        }

        const ac = new AbortController();
        const args = {
            action: 'remove'
        };
        if (image.nameOrId !== image.idShort) {
            args.repoTag = image.nameOrId;
        }
        dataModel.imageAction(image.idShort, args, ac)
            .then(d => {
                onClose();
                let msg = (<span>
                    Image <b>{image.idShort}</b> {d}.
                </span>);
                if (image.nameOrId !== image.idShort) {
                    msg = (<span>
                        Image <b>{image.nameOrId}</b> ({image.idShort}) {d}.
                    </span>);
                }
                enqueueSnackbar(msg, {variant: 'success'});
            })
            .catch(err => {
                if (ac.signal.aborted) {
                    return;
                }
                if (dataModel.errIsNoLogin(err)) {
                    let query = new URLSearchParams();
                    query.append('cb', '/images');
                    navigate('/login?' + query.toString());
                    return;
                }
                let errStr = err.toString();
                if (err.response) {
                    errStr = err.response.data;
                }
                enqueueSnackbar(errStr, {variant: 'error'});
            })
            .finally(() => {
                if (ac.signal.aborted) {
                    return;
                }
                setActioning(false);
            });

        return () => ac.abort();
    }, [actioning, image, navigate, onClose]);

    let dialogImageName = image.nameOrId;
    if (dialogImageName !== image.idShort) {
        dialogImageName = (
            <>
                <b>{dialogImageName}</b> ({image.idShort})
            </>
        );
    } else {
        dialogImageName = (
            <b>{image.idShort}</b>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={handleDialogForceClose}
            aria-labelledby="alert-dialog-title-del"
            aria-describedby="alert-dialog-description-del"
        >
            <DialogTitle id="alert-dialog-title-del">
                Delete image
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description-del">
                    Do you really want to remove {dialogImageName}? <br />
                    The image will be untagged, and will be deleted if there aren't any tags.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleDialogClose} autoFocus disabled={actioning}>
                    Cancel
                </Button>
                <Button onClick={handleDialogConfirm} disabled={actioning} color="error">
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}