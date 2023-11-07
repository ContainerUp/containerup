import {Accordion, AccordionDetails, AccordionSummary} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import SettingName from "./SettingName";

export default function ContainerDetailSettings() {
    return (
        <>
            <Accordion expanded={true}>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                >
                    <Typography>Name</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <SettingName />
                </AccordionDetails>
            </Accordion>
        </>
    );
}