import {Box} from "@mui/material";
import {styled} from "@mui/material/styles";

export default function MyContent({children}) {
    const DrawerHeader = styled('div')(({ theme }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: theme.spacing(0, 1),
        // necessary for content to be below app bar
        ...theme.mixins.toolbar,
    }));

    return (
        <Box component="main" sx={{ flexGrow: 1, p: 2 }}>
            <DrawerHeader />
            {children}
        </Box>
    );
}