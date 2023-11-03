import {useUpdateState} from "./updateStore";
import {
    Alert, Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Link,
} from "@mui/material";
import {useState} from "react";
import UpdateTerminal from "./UpdateTerminal";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BrowserUpdatedIcon from '@mui/icons-material/BrowserUpdated';
import RefreshIcon from '@mui/icons-material/Refresh';
import {create} from "zustand";

const initUpdateState = {
    result: ''
};
const useUpdateStateStore = create(() => initUpdateState);
const setUpdateStateResult = result => {
    useUpdateStateStore.setState(() => ({result}));
};
const resetUpdateStateResult = () => {
    useUpdateStateStore.setState(initUpdateState);
};

export default function UpdateDialog({open, onClose, canUpdate, currentVersion}) {
    const updateInfo = useUpdateState(state => state.update);
    const [updating, setUpdating] = useState(false);

    const handleClose = () => {
        const result = useUpdateStateStore.getState().result;
        if (updating && (result === '' || result === 'failure')) {
            return;
        }
        onClose();
        resetUpdateStateResult();
    };

    const handleDoUpdate = () => {
        setUpdating(true);
    };

    const handleSuccess = () => {
        setUpdateStateResult('success');
    };

    const handleError = () => {
        setUpdateStateResult('error');
    };

    const handleFailure = () => {
        setUpdateStateResult('failure');
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            scroll="paper"
            fullWidth={true}
            maxWidth="md"
            aria-labelledby="update-action-dialog-title"
            aria-describedby="update-action-dialog-description"
        >
            <DialogTitle id="update-action-dialog-title">
                Update
            </DialogTitle>
            <DialogContent dividers={true}>
                {!canUpdate && (
                    <Alert severity="warning" sx={{mb: '8px'}}>
                        Non-containerized ContainerUp can only be updated manually.&nbsp;
                        <a href="https://containerup.org/faq/#why-cant-i-update-with-just-a-click-on-the-web-page"
                           target="_blank" rel="noreferrer">
                            Learn more
                        </a>
                    </Alert>
                )}
                {!updating ? (
                    <DialogContentText id="update-changelog-dialog-description" component="pre">
                        <b>New version: </b>
                        {updateInfo?.version}
                        <br />
                        <b>Image: </b>
                        {updateInfo?.image}
                        <br />
                        <b>Changelog: </b>
                        <br />
                        {updateInfo?.changelog}
                    </DialogContentText>
                ): (
                    <>
                        <DialogContentText id="alert-dialog-description">
                        </DialogContentText>
                        <Box
                            sx={{height: '400px'}}
                        >
                            <UpdateTerminal
                                image={updateInfo.image}
                                currentVersion={currentVersion}
                                targetVersion={updateInfo.version}
                                onSuccess={handleSuccess}
                                onError={handleError}
                                onFailure={handleFailure}
                            />
                        </Box>
                    </>
                )}


            </DialogContent>
            <DialogActions>
                <UpdateDialogButtons
                    onClose={handleClose}
                    canUpdate={canUpdate}
                    updating={updating}
                    handleDoUpdate={handleDoUpdate}
                />
            </DialogActions>
        </Dialog>
    );
}

function UpdateDialogButtons({onClose, canUpdate, updating, handleDoUpdate}) {
    const result = useUpdateStateStore(state => state.result);

    return (
        <>
            {!updating && (
                <Button onClick={onClose}>
                    Cancel
                </Button>
            )}
            {updating && (
                <Button disabled={result === '' || result === 'failure' || result === 'success'} onClick={onClose}>
                    Close
                </Button>
            )}

            {result === '' && (
                <Button disabled={!canUpdate || updating} onClick={handleDoUpdate} startIcon={<BrowserUpdatedIcon fontSize="small" />}>
                    Update
                </Button>
            )}
            {result === 'success' && (
                <Button startIcon={<RefreshIcon fontSize="small" />} component={Link} href="/">
                    Reload
                </Button>
            )}
            {(result === 'error' || result === 'failure') && (
                <Button startIcon={<OpenInNewIcon fontSize="small" />} component={Link} href="https://containerup.org/faq/#updating-containerup" target="_blank">
                    Troubleshoot
                </Button>
            )}
        </>
    );
}
