import {useCallback, useEffect, useState} from "react";
import {Tooltip} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import {useNavigate} from "react-router-dom";
import {getController} from "../../../lib/HostGuestController";
import ImagesTable from "./ImagesTable";
import dataModel from "../../../lib/dataModel";
import ImagePullDialog from "./ImagePullDialog";
import {aioProvider, isConnectError, isDisconnectError} from "../../../lib/dataProvidor";
import {showWebsocketDisconnectError} from "../../../components/notifications/WebsocketDisconnectError";
import ContainerUpLearnMore from "../../../components/ContainerUpLearnMore";
import {closeSnackbar, enqueueSnackbar} from "notistack";
import {imageListActions as storeActions} from "./store";
import showWebsocketConnectError from "../../../components/notifications/WebsocketConnectError";

export default function ImageList() {
    const navigate = useNavigate();

    useEffect(() => {
        let count = 0;

        let tryConnect = () => {};
        let cancel = () => {};
        let retryTimeout = null;
        let tryCount = 0;
        let disconnectKey = null;

        const onData = data => {
            storeActions.setImages(data);

            if (disconnectKey) {
                closeSnackbar(disconnectKey);
                disconnectKey = null;
                tryCount = 0;
            }
            count ++;
        };

        const onError = error => {
            if (dataModel.errIsNoLogin(error)) {
                let query = new URLSearchParams();
                query.append('cb', '/images');
                navigate('/login?' + query.toString());
                return;
            }
            let e = error.toString();
            if (error.response) {
                e = error.response.data;
            }
            // loading
            if (count === 0) {
                if (isConnectError(error)) {
                    storeActions.pushSnackbarKey(showWebsocketConnectError());
                } else {
                    storeActions.pushSnackbarKey(enqueueSnackbar(e, {
                        variant: "error",
                        persist: true
                    }));
                }
                storeActions.setError();
            } else {
                if (isDisconnectError(error) || count) {
                    // if count > 0, it must be a disconnect err
                    if (!disconnectKey) {
                        // do not show multiple disconnect error
                        disconnectKey = showWebsocketDisconnectError();
                    }
                    retryTimeout = setTimeout(() => {
                        tryConnect();
                        retryTimeout = null;
                    }, 1000 * tryCount * tryCount);
                } else {
                    if (disconnectKey) {
                        retryTimeout = setTimeout(() => {
                            tryConnect();
                            retryTimeout = null;
                        }, 1000 * tryCount * tryCount);
                    } else {
                        storeActions.pushSnackbarKey(enqueueSnackbar(e, {
                            variant: "error",
                            persist: true
                        }));
                    }
                }
            }
        };

        tryConnect = () => {
            count = 0;
            cancel = aioProvider().imagesList(onData, onError);
            tryCount ++;
        };

        tryConnect();
        return () => {
            cancel();
            storeActions.reset();
            if (disconnectKey) {
                closeSnackbar(disconnectKey);
                disconnectKey = null;
            }
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [navigate]);

    useEffect(() => {
        const ctrl = getController('bar_button');
        const unregister = ctrl.asControllerGuest(<ImageListBarButtons />);
        return () => unregister();
    }, []);

    useEffect(() => {
        const ctrl = getController('bar_breadcrumb');
        const unregister = ctrl.asControllerGuest([{text: 'Images'}]);
        return () => unregister();
    }, []);

    useEffect(() => {
        document.title = 'ContainerUp - Images';
    }, []);

    return (
        <>
            <ImagesTable />

            <ContainerUpLearnMore variant="long" />
        </>
    );
}

export function ImageListBarButtons() {
    const [pullDialogOpen, setPullDialogOpen] = useState(false);

    const handleCloseDialog = useCallback(() => {
        setPullDialogOpen(false);
    }, []);

    return (
        <>
            <Tooltip title="Pull an image">
                <IconButton
                    aria-label="pull an container"
                    color="inherit"
                    onClick={() => setPullDialogOpen(true)}
                >
                    <CloudDownloadIcon />
                </IconButton>
            </Tooltip>

            <ImagePullDialog open={pullDialogOpen} onClose={handleCloseDialog} />
        </>
    );
}
