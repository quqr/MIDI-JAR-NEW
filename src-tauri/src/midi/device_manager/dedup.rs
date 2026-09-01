//! MIDI 消息去重器：环形缓存 + 时间窗口。
//!
//! 平台 MIDI 栈（如虚拟端口回环）可能在数毫秒内重复投递同一条消息，
//! 这里用固定容量的环形缓存记录最近消息，
//! 在时间窗口内内容相同的消息判定为重复、只处理一次。

/// 去重时间窗口（毫秒）：窗口内内容相同的消息视为重复
const DEDUP_INTERVAL_MS: u128 = 5;
/// 去重环形缓存容量
const DEDUP_CACHE_SIZE: usize = 32;

/// 缓存的消息条目
struct CachedMessage {
    data: Vec<u8>,
    timestamp_ms: u128,
}

/// 去重器：维护最近消息的环形缓存
pub(super) struct MidiDedup {
    cache: Vec<CachedMessage>,
    index: usize,
}

impl MidiDedup {
    /// 创建空缓存的去重器。
    pub(super) fn new() -> Self {
        Self {
            cache: Vec::with_capacity(DEDUP_CACHE_SIZE),
            index: 0,
        }
    }

    /// 判断消息是否为窗口内重复；非重复则记入缓存并返回 false。
    pub(super) fn is_duplicate(&mut self, message: &[u8], timestamp_ms: u128) -> bool {
        for cached in &self.cache {
            if timestamp_ms.abs_diff(cached.timestamp_ms) <= DEDUP_INTERVAL_MS
                && cached.data.len() == message.len()
                && cached.data == message
            {
                return true;
            }
        }
        if self.cache.len() < DEDUP_CACHE_SIZE {
            self.cache.push(CachedMessage {
                data: message.to_vec(),
                timestamp_ms,
            });
        } else {
            // 缓存已满：环形覆盖最旧条目
            self.cache[self.index % DEDUP_CACHE_SIZE] = CachedMessage {
                data: message.to_vec(),
                timestamp_ms,
            };
            self.index += 1;
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_duplicate_within_window() {
        let mut d = MidiDedup::new();
        assert!(!d.is_duplicate(&[0x90, 60, 100], 1_000));
        assert!(d.is_duplicate(&[0x90, 60, 100], 1_002));
    }

    #[test]
    fn expires_after_window() {
        let mut d = MidiDedup::new();
        assert!(!d.is_duplicate(&[0x90, 60, 100], 1_000));
        assert!(!d.is_duplicate(&[0x90, 60, 100], 1_000 + DEDUP_INTERVAL_MS + 1));
    }

    #[test]
    fn different_content_not_duplicate() {
        let mut d = MidiDedup::new();
        assert!(!d.is_duplicate(&[0x90, 60, 100], 1_000));
        assert!(!d.is_duplicate(&[0x90, 61, 100], 1_001));
    }

    #[test]
    fn ring_buffer_overwrites_old_entries() {
        let mut d = MidiDedup::new();
        // 填满缓存（时间戳间隔远超窗口，互不重复）
        for i in 0..DEDUP_CACHE_SIZE {
            assert!(!d.is_duplicate(&[i as u8], 100 * i as u128));
        }
        // 新消息覆盖最旧条目后，仍能正确去重新消息
        assert!(!d.is_duplicate(&[0xFF], 10_000));
        assert!(d.is_duplicate(&[0xFF], 10_001));
    }
}
