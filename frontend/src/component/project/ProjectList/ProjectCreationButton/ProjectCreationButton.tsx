import { useContext, type FC } from 'react';
import type { ITooltipResolverProps } from 'component/common/TooltipResolver/TooltipResolver';
import AccessContext from 'contexts/AccessContext';
import ResponsiveButton from 'component/common/ResponsiveButton/ResponsiveButton';
import { CREATE_PROJECT } from 'component/providers/AccessProvider/permissions';
import Add from '@mui/icons-material/Add';
import { CreateProjectDialog } from '../../Project/CreateProject/NewCreateProjectForm/CreateProjectDialog.tsx';

interface ICreateButtonData {
    disabled: boolean;
    tooltip?: Omit<ITooltipResolverProps, 'children'>;
}

const NAVIGATE_TO_CREATE_PROJECT = 'NAVIGATE_TO_CREATE_PROJECT';

function resolveCreateButtonData(hasAccess: boolean): ICreateButtonData {
    if (!hasAccess) {
        return {
            tooltip: {
                title: 'You do not have permission to create new projects',
            },
            disabled: true,
        };
    } else {
        return {
            tooltip: { title: 'Click to create a new project' },
            disabled: false,
        };
    }
}

type ProjectCreationButtonProps = {
    isDialogOpen: boolean;
    setIsDialogOpen: (value: boolean) => void;
};

export const ProjectCreationButton: FC<ProjectCreationButtonProps> = ({
    isDialogOpen,
    setIsDialogOpen,
}) => {
    const { hasAccess } = useContext(AccessContext);

    const createButtonData = resolveCreateButtonData(hasAccess(CREATE_PROJECT));

    return (
        <>
            <ResponsiveButton
                Icon={Add}
                onClick={() => setIsDialogOpen(true)}
                maxWidth='700px'
                permission={CREATE_PROJECT}
                disabled={createButtonData.disabled}
                tooltipProps={createButtonData.tooltip}
                data-testid={NAVIGATE_TO_CREATE_PROJECT}
            >
                New project
            </ResponsiveButton>
            <CreateProjectDialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
            />
        </>
    );
};
