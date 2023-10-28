import {Alert} from "@mui/material";

export default function ContainerUpLearnMore({variant}) {
    if (!process.env.REACT_APP_CONTAINERUP_DEMO) {
        return '';
    }

    if (variant === "long") {
        return (
            <Alert severity="info" sx={{mt: '5px'}}>
                Love this project? Learn more about ContainerUp <a href="https://containerup.org/" target="_blank" rel="noreferrer">here</a>.
            </Alert>
        );
    }

    return (
        <Alert severity="info" sx={{mt: '5px'}}>
            Learn more about ContainerUp <a href="https://containerup.org/" target="_blank" rel="noreferrer">here</a>.
        </Alert>
    );
}