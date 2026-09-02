import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router';
import { Button, Listbox, ListboxItem } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import SettingsSplitLayout from '../SettingsSplitLayout';
import { useAgentsStore } from '@/stores/useAgentsStore';
import AgentEditor from './AgentEditor';
import DefaultAgentEditor from './DefaultAgentEditor';

function AgentEditorRoute() {
  const { id } = useParams();
  const agents = useAgentsStore((s) => s.agents);
  const agent = agents.find((a) => a.id === Number(id));
  if (!agent) return null;
  if (agent.isBuiltin) return <DefaultAgentEditor key={agent.id} agent={agent} />;
  return <AgentEditor key={agent.id} agent={agent} />;
}

function SettingsAgents() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = location.pathname.split('/').pop();
  const agents = useAgentsStore((s) => s.agents);
  const createAgent = useAgentsStore((s) => s.createAgent);

  const handleCreate = async () => {
    const created = await createAgent({ name: t('settings.agents.newAgentName') });
    navigate(`/settings/agents/${created.id}`);
  };

  return (
    <SettingsSplitLayout
      title={t('settings.agents.title')}
      headerAction={
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={handleCreate}
          aria-label={t('settings.agents.addAgent')}
        >
          <Icon icon="plus" size={16} />
        </Button>
      }
      list={
        <Listbox aria-label={t('settings.agents.title')}>
          {agents.map((agent) => (
            <ListboxItem
              className={String(agent.id) === activeId ? 'bg-default' : ''}
              key={agent.id}
              href={`/settings/agents/${agent.id}`}
              startContent={
                <Icon
                  icon="bot"
                  className="ml-2 flex items-center justify-center leading-none"
                  size={18}
                />
              }
              textValue={agent.name}
            >
              {agent.name}
            </ListboxItem>
          ))}
        </Listbox>
      }
      details={
        <Routes>
          <Route path=":id" element={<AgentEditorRoute />} />
        </Routes>
      }
    />
  );
}

export default SettingsAgents;
