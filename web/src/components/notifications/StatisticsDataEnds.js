import {Button} from "@mui/material";
import {enqueueSnackbar} from "notistack";

export default function StatisticsDataEnds() {
    const action = (
        <Button
            color="inherit"
            size="small"
            component="a"
            href="https://containerup.org/faq/#the-statistics-data-stream-is-ended"
            target="_blank"
        >
            Learn more
        </Button>
    );

    return enqueueSnackbar('The statistics data stream is ended.', {
        variant: 'warning',
        persist: true,
        action
    });
}