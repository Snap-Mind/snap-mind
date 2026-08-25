import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router';
import { Button, Divider, Listbox, ListboxItem } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import { useAgentsStore } from '@/stores/useAgentsStore';
import AgentEditor from './AgentEditor';

function AgentEditorRoute() {
  const { id } = useParams();
  const agents = useAgentsStore((s) => s.agents);
  const agent = agents.find((a) => a.id === Number(id));
  if (!agent) return null;
  return <AgentEditor agent={agent} />;
}

function SettingsAgents() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // The `:id` segment belongs to the child route, so this component reads it from the path.
  const activeId = location.pathname.split('/').pop();
  const agents = useAgentsStore((s) => s.agents);
  const createAgent = useAgentsStore((s) => s.createAgent);

  const handleCreate = async () => {
    const created = await createAgent({ name: t('settings.agents.newAgentName') });
    navigate(`/settings/agents/${created.id}`);
  };

  return (
    <div className="setting-container grid grid-cols-[250px_1px_1fr] grid-rows-1 h-full min-h-0">
      <div className="setting-category bg-background min-h-0">
        <div className="container grid grid-cols-1 grid-rows-[65px_minmax(0,1fr)] h-full min-h-0 px-3 py-3">
          <div className="header flex items-start justify-between">
            <h1 className="font-bold text-2xl">{t('settings.agents.title')}</h1>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleCreate}
              aria-label={t('settings.agents.addAgent')}
            >
              <Icon icon="plus" size={16} />
            </Button>
          </div>
          <div className="body min-h-0 overflow-y-auto">
            <Divider className="mb-4" />
            <Listbox aria-label={t('settings.agents.title')}>
              {agents.map((agent) => (
                <ListboxItem
                  className={String(agent.id) === activeId ? 'bg-default' : ''}
                  key={agent.id}
                  href={`/settings/agents/${agent.id}`}
                  startContent={<Icon icon="bot" className="inline-block ml-2" size={18} />}
                  textValue={agent.name}
                >
                  {agent.name}
                </ListboxItem>
              ))}
            </Listbox>
          </div>
        </div>
      </div>
      <Divider orientation="vertical" />
      <div className="setting-details h-full min-h-0 overflow-y-auto bg-background px-3 py-3">
        <Routes>
          <Route path=":id" element={<AgentEditorRoute />} />
        </Routes>
      </div>
    </div>
  );
}

export default SettingsAgents;
