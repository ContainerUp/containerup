import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from "@mui/material";
import {uiActions, useContainerStore} from "./store";

export default function DialogDiscard() {
    const open = useContainerStore(state => state.showDialogDiscard);

    const handleDialogCancel = () => {
        uiActions.closeDialog();
    };

    const handleDialogDiscard = () => {
        uiActions.confirmDiscard();
    };

    return (
        <Dialog
            open={open}
            onClose={handleDialogCancel}
            aria-labelledby="alert-dialog-title-discard"
            aria-describedby="alert-dialog-description-discard"
            fullWidth
        >
            <DialogTitle id="alert-dialog-title-discard">
                Discard the changes?
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description-discard">
                    You have unsaved changes.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleDialogDiscard} color="warning">
                    Discard
                </Button>
                <Button autoFocus onClick={handleDialogCancel}>
                    Continue editing
                </Button>
            </DialogActions>
        </Dialog>
    );
}