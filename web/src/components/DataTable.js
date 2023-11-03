import {Paper, Table, TableBody, TableCell, TableContainer, TableRow} from "@mui/material";

export function DataTable({children}) {
return (
        <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }}>
                <TableBody>
                    {children}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export function DataTableRow({children}) {
    return (
        <TableRow>
            {children}
        </TableRow>
    );
}

export function DataTableRowLabel({children}) {
    return (
        <TableCell variant="head" sx={{width: 160}}>
            {children}
        </TableCell>
    );
}

export function DataTableRowContent({sx, children}) {
    return (
        <TableCell sx={sx} variant="body">
            {children}
        </TableCell>
    );
}
