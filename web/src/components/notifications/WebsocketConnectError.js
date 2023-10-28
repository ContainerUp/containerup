import {Button} from "@mui/material";
import {enqueueSnackbar} from "notistack";

export default function showWebsocketConnectError(isOverview = false) {
    let url = 'https://containerup.org/faq/#cannot-connect-to-websocket';
    if (isOverview) {
        url = 'https://containerup.org/faq/#i-see-this-notice-immediately-after-opening-the-overview-page-or-the-container-statistics-page';
    }

    const action = (
        <Button
            size="small"
            color="inherit"
            href={url}
            target="_blank"
        >
            Troubleshoot!
        </Button>
    );

    return enqueueSnackbar('Cannot connect to WebSocket.', {
        variant: 'error',
        persist: true,
        action
    });
}