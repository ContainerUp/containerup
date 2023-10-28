import {styled} from "@mui/material/styles";
import {TableCell as MuiTableCell} from "@mui/material";

export const ResponsiveTableCell = styled(MuiTableCell)(({theme}) => ({
    [theme.breakpoints.down('xl')]: {
        padding: 12
    },
    [theme.breakpoints.down('lg')]: {
        padding: 6
    },
    [theme.breakpoints.down('md')]: {
        padding: 3
    }
}));
