import {
    Box,
    Button, Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel, FormGroup, Skeleton, Stack
} from "@mui/material";
import {useEffect, useState} from "react";
import {getController} from "../../lib/HostGuestController";
import {useOutletContext, useSearchParams} from "react-router-dom";
import {closeSnackbar, enqueueSnackbar} from "notistack";
import {getChannel, keyCheckUpdateAuto, manuallyCheck, setChannel, setImage, useUpdateState} from "./updateStore";
import {green} from "@mui/material/colors";
import {DataTable, DataTableRow, DataTableRowContent, DataTableRowLabel} from "../../components/DataTable";
import UpdateDialog from "./UpdateDialog";

const keyCheckUpdateRemember = "update_check_remember";

const loadingEl = (<Skeleton animation="wave" variant="text" sx={{maxWidth: "480px"}}/>);

export default function SystemUpdate() {
    const {infoData, loading, errMsg} = useOutletContext();
    const [searchParams] = useSearchParams();

    const checked = useUpdateState(state => state.checked);
    const checking = useUpdateState(state => state.checking);
    const updateInfo = useUpdateState(state => state.update);
    const [showAlertDialog, setShowAlertDialog] = useState(false);
    const [alertDialogType, setAlertDialogType] = useState('');
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);
    const [updateDialogVersion, setUpdateDialogVersion] = useState(0);

    const [remember, setRemember] = useState(() => {
        const rem = localStorage.getItem(keyCheckUpdateRemember);
        return rem === "1";
    });
    const [auto, setAuto] = useState(() => {
        const auto = localStorage.getItem(keyCheckUpdateAuto);
        return auto === "1";
    });

    const forceChannel = searchParams.get('channel');
    if (forceChannel) {
        setChannel(forceChannel);
    }
    const forceImage = searchParams.get('image');
    if (forceImage) {
        setImage(forceImage);
    }

    const handleClickCheck = () => {
        if (localStorage.getItem(keyCheckUpdateRemember) === "1") {
            manuallyCheck(infoData.container_up.version);
            return;
        }
        setRemember(false);
        setShowAlertDialog(true);
        setAlertDialogType('manual');
    };

    const handleChangeAuto = event => {
        const auto = event.target.checked;
        if (auto) {
            if (localStorage.getItem(keyCheckUpdateRemember) !== "1") {
                setShowAlertDialog(true);
                setAlertDialogType('auto');
                return;
            }
            localStorage.setItem(keyCheckUpdateAuto, "1");
            setAuto(true);
            return;
        }
        localStorage.removeItem(keyCheckUpdateAuto);
        setAuto(false);
    };

    const handleAlertDialogCancel = () => {
        setShowAlertDialog(false);
    };

    const handleAlertDialogConfirm = () => {
        setShowAlertDialog(false);
        if (alertDialogType === 'manual') {
            if (remember) {
                localStorage.setItem(keyCheckUpdateRemember, "1");
            }
            manuallyCheck(infoData.container_up.version);
        }
        if (alertDialogType === 'auto') {
            // localStorage.setItem(keyCheckUpdateRemember, "1");
            localStorage.setItem(keyCheckUpdateAuto, "1");
            setAuto(true);
        }
    };

    const handleChangeRemember = event => {
        setRemember(event.target.checked);
    };

    const handleClickLearnMore = () => {
        setShowUpdateDialog(true);
    };

    const handleCloseUpdateDialog = () => {
        setShowUpdateDialog(false);
        setUpdateDialogVersion(v => v + 1);
    };

    useEffect(() => {
        document.title = "ContainerUp - System Update";

        const ctrl = getController('bar_breadcrumb');
        const unregister = ctrl.asControllerGuest([{text: 'System Update'}]);
        return () => unregister();
    }, []);

    useEffect(() => {
        if (errMsg !== "") {
            const key = enqueueSnackbar(errMsg, {persist: true, variant: 'error'});
            return () => {
                closeSnackbar(key);
            };
        }
    }, [errMsg]);

    return (
        <>
            <DataTable>
                <DataTableRow>
                    <DataTableRowLabel>
                        Channel
                    </DataTableRowLabel>
                    <DataTableRowContent>
                        {loading ? loadingEl : (infoData ? getChannel(infoData?.container_up.version) : '')}
                    </DataTableRowContent>
                </DataTableRow>

                <DataTableRow>
                    <DataTableRowLabel>
                        Installed version
                    </DataTableRowLabel>
                    <DataTableRowContent>
                        {loading ? loadingEl : (infoData ? (infoData?.container_up.version) : '')}
                    </DataTableRowContent>
                </DataTableRow>

                <DataTableRow>
                    <DataTableRowLabel>
                        Latest version
                    </DataTableRowLabel>
                    <DataTableRowContent sx={{padding: '12px 16px'}}>
                        {loading ? loadingEl : (
                            <>
                                {!checked && !checking && (
                                    <Stack direction="row" spacing={1}>
                                        <Box sx={{pt: '5px'}}>
                                            Not checked yet
                                        </Box>
                                        <Button onClick={handleClickCheck} variant="outlined" size="small" disabled={!!errMsg}>
                                            Check
                                        </Button>
                                    </Stack>
                                )}

                                {checking && 'Checking...'}

                                {updateInfo ? (
                                    <Stack direction="row" spacing={1}>
                                        <Box sx={{color: green[500], pt: '5px'}}>
                                            {updateInfo.version}
                                        </Box>
                                        <Button onClick={handleClickLearnMore} variant="outlined" size="small">
                                            Learn more
                                        </Button>
                                    </Stack>
                                ) : (
                                    checked && (
                                        <>
                                            Failed to check. Check on <a href="https://containerup.org/" target="_blank" rel="noreferrer">containerup.org</a>.
                                        </>
                                    )
                                )}
                            </>
                        )}
                    </DataTableRowContent>
                </DataTableRow>

                <DataTableRow>
                    <DataTableRowLabel>
                        Update option
                    </DataTableRowLabel>
                    <DataTableRowContent sx={{padding: '12px 16px'}}>
                        <FormGroup>
                            <FormControlLabel
                                control={<Checkbox checked={auto} onChange={handleChangeAuto} size="small" />}
                                disableTypography={true}
                                label="Check update automatically"
                            />
                        </FormGroup>
                    </DataTableRowContent>
                </DataTableRow>

            </DataTable>

            <Dialog
                open={showAlertDialog}
                onClose={handleAlertDialogCancel}
                aria-labelledby="update-privacy-dialog-title"
                aria-describedby="update-privacy-dialog-description"
            >
                <DialogTitle id="update-privacy-dialog-title">
                    Check update from containerup.org?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="update-privacy-dialog-description">
                        A browser request will be sent to <a href="https://containerup.org" target="_blank" rel="noreferrer">containerup.org</a>.<br />
                        Your IP address, User-Agent, Cookies, and other information may be collected for analytical purposes.
                    </DialogContentText>
                    <FormGroup>
                        <FormControlLabel
                            control={<Checkbox checked={remember || alertDialogType==='auto'} onChange={handleChangeRemember} disabled={alertDialogType==='auto'} />}
                            label="Don't ask me again"
                        />
                    </FormGroup>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleAlertDialogCancel}>
                        Disagree
                    </Button>
                    <Button onClick={handleAlertDialogConfirm} autoFocus>
                        Agree
                    </Button>
                </DialogActions>
            </Dialog>

            <UpdateDialog
                open={showUpdateDialog}
                onClose={handleCloseUpdateDialog}
                canUpdate={!!infoData?.container_up.container_hostname}
                key={updateDialogVersion}
                currentVersion={infoData?.container_up.version}
            />
        </>
    );
}