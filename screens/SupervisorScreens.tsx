import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Chip,
  Dialog,
  Portal,
  RadioButton,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import { useAuth } from '../hooks/useAuth';
import {
  fetchMaintenancePersonnel,
  fetchSupervisorTasks,
  flagTask,
  reassignTask,
  type MaintenancePerson,
} from '../lib/supervisor-api';
import { CHECKLIST_LABELS, formatTaskStatus } from '../lib/tasks';
import type { SupervisorStackParamList, Task } from '../types';

type DashboardProps = NativeStackScreenProps<
  SupervisorStackParamList,
  'SupervisorDashboard'
>;
type TaskDetailProps = NativeStackScreenProps<
  SupervisorStackParamList,
  'SupervisorTaskDetail'
>;
type ReviewDetailProps = NativeStackScreenProps<
  SupervisorStackParamList,
  'CompletedReviewDetail'
>;

function formatDate(date?: Date | null): string {
  return date
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
    : 'Not recorded';
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) {
    return 'N/A';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${remainder} sec`;
}

function statusColor(person: MaintenancePerson): string {
  if (person.currentTaskId) {
    return '#f7d5d2';
  }

  return person.isAvailable ? '#d8f2db' : '#fff1bd';
}

function useSupervisorData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<MaintenancePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextTasks, nextPeople] = await Promise.all([
        fetchSupervisorTasks(),
        fetchMaintenancePersonnel(),
      ]);
      setTasks(nextTasks);
      setPeople(nextPeople);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load supervisor data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { tasks, people, loading, error, refresh, clearError: () => setError(null) };
}

export function SupervisorDashboardScreen({
  navigation,
}: DashboardProps): React.JSX.Element {
  const { tasks, people, error, clearError } = useSupervisorData();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeToday = tasks.filter(
    (task) => task.createdAt >= today && task.status !== 'completed',
  );
  const available = people.filter((person) => person.isAvailable).length;
  const onTask = people.filter((person) => person.currentTaskId).length;
  const offline = Math.max(0, people.length - available - onTask);
  const unassigned = activeToday.filter(
    (task) => task.status === 'unassigned' || !task.assignedTo,
  ).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card mode="contained" style={styles.summaryCard}>
          <Card.Content>
            <Text variant="labelLarge">Total active tasks today</Text>
            <Text variant="displaySmall">{activeToday.length}</Text>
          </Card.Content>
        </Card>
        <Card mode="contained" style={styles.summaryCard}>
          <Card.Content>
            <Text variant="labelLarge">Maintenance personnel</Text>
            <Text variant="titleLarge">
              {available} available, {onTask} on task, {offline} offline
            </Text>
          </Card.Content>
        </Card>
        <Card
          mode="contained"
          style={[styles.summaryCard, unassigned > 0 && styles.urgentCard]}
        >
          <Card.Content>
            <Text variant="labelLarge">Unassigned tasks</Text>
            <Text variant="displaySmall">{unassigned}</Text>
          </Card.Content>
        </Card>
        <Button mode="contained" onPress={() => navigation.navigate('SupervisorTasks')}>
          Manage Tasks
        </Button>
        <Button mode="outlined" onPress={() => navigation.navigate('TeamAvailability')}>
          Team Availability
        </Button>
        <Button mode="outlined" onPress={() => navigation.navigate('CompletedReviews')}>
          Review Completed Tasks
        </Button>
      </ScrollView>
      <Snackbar visible={error !== null} onDismiss={clearError}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

export function TeamAvailabilityScreen(): React.JSX.Element {
  const { user } = useAuth();
  const { people, tasks, error, clearError } = useSupervisorData();
  const visiblePeople = people.filter(
    (person) => !user?.building || person.building === user.building,
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={visiblePeople}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const task = item.currentTaskId
            ? tasks.find((candidate) => candidate.id === item.currentTaskId)
            : null;
          return (
            <Card mode="elevated" style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium">{item.displayName}</Text>
                  <Chip style={{ backgroundColor: statusColor(item) }}>
                    {item.currentTaskId ? 'On Task' : item.isAvailable ? 'Available' : 'Offline'}
                  </Chip>
                </View>
                <Text variant="bodyMedium">{item.building ?? 'No building set'}</Text>
                {task ? (
                  <Text variant="bodySmall">
                    {task.message} - since {formatDate(task.assignedAt ?? task.createdAt)}
                  </Text>
                ) : null}
              </Card.Content>
            </Card>
          );
        }}
      />
      <Snackbar visible={error !== null} onDismiss={clearError}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

export function SupervisorTasksScreen({
  navigation,
}: NativeStackScreenProps<
  SupervisorStackParamList,
  'SupervisorTasks'
>): React.JSX.Element {
  const { tasks, error, clearError } = useSupervisorData();
  const activeTasks = tasks.filter((task) => task.status !== 'completed');

  return (
    <View style={styles.screen}>
      <FlatList
        data={activeTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <Card
            mode="elevated"
            style={[styles.card, item.status === 'unassigned' && styles.urgentCard]}
            onPress={() => navigation.navigate('SupervisorTaskDetail', { taskId: item.id })}
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium">{item.location}</Text>
                <Chip>{formatTaskStatus(item.status)}</Chip>
              </View>
              <Text variant="bodyMedium">
                {item.component} - {item.floor}, {item.building}
              </Text>
              <Text variant="bodySmall">
                Assignee: {item.assignedTo ?? 'Unassigned'}
              </Text>
            </Card.Content>
          </Card>
        )}
      />
      <Snackbar visible={error !== null} onDismiss={clearError}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

export function SupervisorTaskDetailScreen({
  route,
}: TaskDetailProps): React.JSX.Element {
  const { user } = useAuth();
  const { tasks, people, refresh, error, clearError } = useSupervisorData();
  const task = tasks.find((candidate) => candidate.id === route.params.taskId);
  const availablePeople = people.filter((person) => person.isAvailable);
  const [assignee, setAssignee] = useState('');
  const [reason, setReason] = useState('Manual reassignment');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (!task || !assignee || !user) {
      return;
    }

    setSubmitting(true);
    try {
      await reassignTask({
        taskId: task.id,
        newAssigneeUid: assignee,
        reason,
        supervisorUid: user.uid,
      });
      setMessage('Task reassigned.');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Failed to reassign task.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) {
    return <Text style={styles.content}>Task not found.</Text>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleLarge">{task.location}</Text>
          <Text>{task.message}</Text>
          <Text>Current assignee: {task.assignedTo ?? 'Unassigned'}</Text>
          <Text>{task.floor}, {task.building}</Text>
        </Card.Content>
      </Card>
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Available maintenance</Text>
          <RadioButton.Group onValueChange={setAssignee} value={assignee}>
            {availablePeople.map((person) => (
              <RadioButton.Item
                key={person.id}
                label={person.displayName}
                value={person.id}
              />
            ))}
          </RadioButton.Group>
          <TextInput label="Reason" value={reason} onChangeText={setReason} mode="outlined" />
          <Button
            mode="contained"
            loading={submitting}
            disabled={!assignee || submitting}
            onPress={() => void submit()}
          >
            Reassign
          </Button>
        </Card.Content>
      </Card>
      <Snackbar visible={message !== null || error !== null} onDismiss={() => { setMessage(null); clearError(); }}>
        {message ?? error ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

export function CompletedReviewsScreen({
  navigation,
}: NativeStackScreenProps<
  SupervisorStackParamList,
  'CompletedReviews'
>): React.JSX.Element {
  const { tasks } = useSupervisorData();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completed = tasks.filter(
    (task) => task.status === 'completed' && (task.completedAt ?? task.createdAt) >= today,
  );

  return (
    <FlatList
      style={styles.screen}
      data={completed}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <Card
          mode="elevated"
          style={styles.card}
          onPress={() => navigation.navigate('CompletedReviewDetail', { taskId: item.id })}
        >
          <Card.Content>
            <Text variant="titleMedium">{item.location}</Text>
            <Text>{formatDate(item.completedAt)} - {formatDuration(item.workDuration)}</Text>
          </Card.Content>
        </Card>
      )}
    />
  );
}

export function CompletedReviewDetailScreen({
  route,
}: ReviewDetailProps): React.JSX.Element {
  const { user } = useAuth();
  const { tasks } = useSupervisorData();
  const task = tasks.find((candidate) => candidate.id === route.params.taskId);
  const [reason, setReason] = useState('Requires re-inspection');
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!task) {
    return <Text style={styles.content}>Task not found.</Text>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.photoRow}>
        {task.beforePhotoUrl ? <Image source={{ uri: task.beforePhotoUrl }} style={styles.photo} /> : null}
        {task.afterPhotoUrl ? <Image source={{ uri: task.afterPhotoUrl }} style={styles.photo} /> : null}
      </View>
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Checklist</Text>
          {CHECKLIST_LABELS.map((item) => (
            <Text key={item.key}>
              {task.checklist?.[item.key] === 'na' ? 'N/A' : '✓'} {item.label}
            </Text>
          ))}
          <Text>Remarks: {task.remarks || 'None'}</Text>
          <Text>Response time: {formatDuration(task.responseTime)}</Text>
          <Text>Work duration: {formatDuration(task.workDuration)}</Text>
          <Text>Completed by: {task.completedBy ?? 'Unknown'}</Text>
          {task.biometricVerified ? <Chip>Biometric verified</Chip> : null}
          <Button mode="contained-tonal" onPress={() => setVisible(true)}>
            Flag for Re-inspection
          </Button>
        </Card.Content>
      </Card>
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Flag task</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Reason" value={reason} onChangeText={setReason} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>Cancel</Button>
            <Button
              onPress={() => {
                if (!user) return;
                void flagTask({
                  taskId: task.id,
                  reason,
                  supervisorUid: user.uid,
                })
                  .then(() => setMessage('Task flagged for re-inspection.'))
                  .catch((caught) =>
                    setMessage(caught instanceof Error ? caught.message : 'Failed to flag task.'),
                  )
                  .finally(() => setVisible(false));
              }}
            >
              Flag
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)}>
        {message ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3faf8',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  summaryCard: {
    borderRadius: 18,
  },
  urgentCard: {
    backgroundColor: '#ffe2de',
  },
  card: {
    borderRadius: 16,
  },
  cardContent: {
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photo: {
    flex: 1,
    height: 180,
    borderRadius: 10,
    backgroundColor: '#dfe7e4',
  },
});
