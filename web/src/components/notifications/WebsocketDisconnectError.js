import {enqueueSnackbar} from "notistack";
import {Button} from "@mui/material";

export function showWebsocketDisconnectError() {
    const action = (
        <Button
            color="inherit"
            size="small"
            onClick={() => window.location.reload()}
        >
            Reload
        </Button>
    );

    return enqueueSnackbar('Websocket disconnected. The information on this page is NOT up-to-date.', {
        variant: 'warning',
        persist: true,
        action
    });
}
