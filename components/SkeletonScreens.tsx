import { StyleSheet, View } from 'react-native';

function SkeletonBlock({
  width = '100%',
  height,
  radius = 14,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.skeletonBlock,
        {
          width,
          height,
          borderRadius: radius,
        },
        style,
      ]}
    />
  );
}

function HeaderSkeleton(): React.JSX.Element {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleGroup}>
        <SkeletonBlock width="48%" height={34} radius={10} />
        <SkeletonBlock width="70%" height={16} radius={8} />
      </View>
      <SkeletonBlock width={42} height={42} radius={12} />
    </View>
  );
}

function BottomTabsSkeleton(): React.JSX.Element {
  return (
    <View style={styles.bottomTabs}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.tabItem}>
          <SkeletonBlock width={30} height={30} radius={15} />
          <SkeletonBlock width={58} height={12} radius={6} />
        </View>
      ))}
    </View>
  );
}

export function AppStartupSkeleton(): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <HeaderSkeleton />

      <View style={styles.content}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <SkeletonBlock width="58%" height={16} radius={8} />
            <SkeletonBlock width="34%" height={48} radius={12} />
          </View>
          <View style={styles.summaryCardAlt}>
            <SkeletonBlock width="72%" height={16} radius={8} />
            <SkeletonBlock width="34%" height={48} radius={12} />
          </View>
        </View>

        <View style={styles.filterRow}>
          <SkeletonBlock width={86} height={44} radius={14} />
          <SkeletonBlock width={108} height={44} radius={14} />
          <SkeletonBlock width={130} height={44} radius={14} />
        </View>

        {[0, 1].map((item) => (
          <View key={item} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <View style={styles.taskTitleGroup}>
                <SkeletonBlock width="52%" height={18} radius={8} />
                <SkeletonBlock width="44%" height={14} radius={7} />
              </View>
              <SkeletonBlock width={94} height={46} radius={12} />
            </View>
            <SkeletonBlock width="88%" height={24} radius={10} />
            <SkeletonBlock width="72%" height={14} radius={7} />
            <SkeletonBlock width="46%" height={42} radius={18} style={styles.taskAction} />
          </View>
        ))}
      </View>

      <BottomTabsSkeleton />
    </View>
  );
}

export function TaskDetailSkeleton(): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <View style={styles.detailContent}>
        <View style={styles.detailHero}>
          <SkeletonBlock width="46%" height={30} radius={10} />
          <SkeletonBlock width="76%" height={26} radius={10} />
          <SkeletonBlock width="86%" height={18} radius={8} />
          <SkeletonBlock width={104} height={42} radius={12} />
        </View>

        <View style={styles.detailCard}>
          <SkeletonBlock width="58%" height={20} radius={8} />
          <SkeletonBlock width="92%" height={28} radius={10} />
        </View>

        <View style={styles.detailCard}>
          {[0, 1, 2, 3].map((item) => (
            <View key={item} style={styles.detailRow}>
              <SkeletonBlock width="38%" height={14} radius={7} />
              <SkeletonBlock width="78%" height={22} radius={9} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8FA',
  },
  skeletonBlock: {
    backgroundColor: '#E5E7EB',
  },
  header: {
    minHeight: 96,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 2,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 10,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 14,
  },
  summaryCard: {
    flex: 1,
    minHeight: 118,
    padding: 18,
    gap: 16,
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryCardAlt: {
    flex: 1,
    minHeight: 118,
    padding: 18,
    gap: 16,
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  taskCard: {
    padding: 18,
    gap: 14,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  taskHeader: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  taskTitleGroup: {
    flex: 1,
    gap: 8,
  },
  taskAction: {
    alignSelf: 'flex-end',
  },
  bottomTabs: {
    minHeight: 74,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderTopColor: '#dce5e2',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    alignItems: 'center',
    gap: 8,
  },
  detailContent: {
    padding: 16,
    gap: 16,
  },
  detailHero: {
    padding: 20,
    gap: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailCard: {
    padding: 18,
    gap: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  detailRow: {
    gap: 8,
  },
});
