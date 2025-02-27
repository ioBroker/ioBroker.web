import React from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

interface CustomModalProps {
    open: boolean;
    close: () => void;
    children: React.JSX.Element;
    titleButton: string;
    titleButton2: string;
    buttonClick: () => void;
}

export function CustomModal(props: CustomModalProps): React.JSX.Element {
    const { open, close, children, titleButton, titleButton2, buttonClick } = props;
    return (
        <Dialog
            open={open}
            maxWidth="md"
            onClose={close}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">{I18n.t('Warning')}</DialogTitle>
            <DialogContent>{children}</DialogContent>
            <DialogActions>
                {titleButton && (
                    <Button
                        color="grey"
                        variant="contained"
                        onClick={buttonClick}
                    >
                        {titleButton}
                    </Button>
                )}
                {titleButton2 && (
                    <Button
                        variant="contained"
                        onClick={close}
                        color="primary"
                        autoFocus
                    >
                        {titleButton2}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default CustomModal;
