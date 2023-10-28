import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from "@mui/material";

export default function ContainerDialogRemove({containerName, containerIdShort, actioning, open, onClose, onConfirm}) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby="alert-dialog-title-rm"
            aria-describedby="alert-dialog-description-rm"
        >
            <DialogTitle id="alert-dialog-title-rm">
                Remove container
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description-rm">
                    Do you really want to remove <b>{containerName}</b> ({containerIdShort})? <br />
                    This container will be removed permanently. You cannot undo this action.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} autoFocus disabled={actioning}>
                    Cancel
                </Button>
                <Button onClick={onConfirm} disabled={actioning} color="error">
                    Remove
                </Button>
            </DialogActions>
        </Dialog>
    );
}