import {useEffect, useMemo} from "react";
import {useNavigate} from "react-router-dom";
import dataModel from "../../../lib/dataModel";
import ContainersTable from "./ContainersTable";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import {Tooltip} from "@mui/material";
import {getController} from "../../../lib/HostGuestController";
import IconButton from "@mui/material/IconButton";
import {Link as RouterLink} from 'react-router-dom';
import {aioProvider, isConnectError, isDisconnectError} from "../../../lib/dataProvidor";
import {showWebsocketDisconnectError} from "../../../components/notifications/WebsocketDisconnectError";
import ContainerUpLearnMore from "../../../components/ContainerUpLearnMore";
import {closeSnackbar, enqueueSnackbar} from "notistack";
import showWebsocketConnectError from "../../../components/notifications/WebsocketConnectError";
import {containerListActions as storeActions} from "./store";

export default function ContainersList() {
    const navigate = useNavigate();

    useEffect(() => {
        let count = 0;

        let tryConnect = () => {};
        let cancel = () => {};
        let retryTimeout = null;
        let tryCount = 0;
        let disconnectKey = null;

        const onData = data => {
            storeActions.setContainers(data);

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
                query.append('cb', '/containers');
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
            cancel = aioProvider().containersList(onData, onError);
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

    const barButtons = useMemo(() => (
        <Tooltip title="Create a container">
            <IconButton
                aria-label="create a container"
                color="inherit"
                to="/containers_create"
                component={RouterLink}
            >
                <AddCircleOutlineIcon />
            </IconButton>
        </Tooltip>
    ), []);

    useEffect(() => {
        const ctrl = getController('bar_button');
        const unregister = ctrl.asControllerGuest(barButtons);
        return () => unregister();
    }, [barButtons]);

    useEffect(() => {
        const ctrl = getController('bar_breadcrumb');
        const unregister = ctrl.asControllerGuest([{text: 'Containers'}]);
        return () => unregister();
    }, []);

    useEffect(() => {
        document.title = 'ContainerUp - Containers';
    }, []);

    return (
        <>
            <ContainersTable />

            <ContainerUpLearnMore variant="long" />
        </>

    );
}