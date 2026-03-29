-- Migration: Add RPC for atomic weak topic updates
-- Description: Handles unique topic addition and limits to last 10 topics.

CREATE OR REPLACE FUNCTION add_weak_topic(target_user_id UUID, new_topic TEXT)
RETURNS VOID AS $$
DECLARE
    current_topics TEXT[];
    topic_exists BOOLEAN;
BEGIN
    -- Get current topics
    SELECT weak_topics INTO current_topics FROM profiles WHERE id = target_user_id;

    -- Check if topic exists (case insensitive)
    SELECT EXISTS (
        SELECT 1 FROM UNNEST(COALESCE(current_topics, ARRAY[]::TEXT[])) t
        WHERE LOWER(t) = LOWER(new_topic)
    ) INTO topic_exists;

    -- Only update if topic doesn't exist
    IF NOT topic_exists THEN
        UPDATE profiles
        SET weak_topics = (
            WITH expanded AS (
                SELECT UNNEST(ARRAY_APPEND(COALESCE(current_topics, ARRAY[]::TEXT[]), new_topic)) as t
            ),
            limited AS (
                SELECT t FROM expanded
                OFFSET GREATEST(0, (SELECT COUNT(*) FROM expanded) - 10)
            )
            SELECT ARRAY_AGG(t) FROM limited
        )
        WHERE id = target_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users (though we'll call it via service role usually)
GRANT EXECUTE ON FUNCTION add_weak_topic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_weak_topic(UUID, TEXT) TO service_role;
