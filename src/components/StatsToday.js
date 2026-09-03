import React, { useEffect, useState } from 'react';

const API_URL = 'https://api.brainteaserday.com';

export default function StatsToday() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [raceBestScore, setRaceBestScore] = useState(null);
  const [raceBestToday, setRaceBestToday] = useState(null);
  const [raceRunsCount, setRaceRunsCount] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `${API_URL}/api/stats/today`
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json?.error || 'Stats indisponibles');
        }

        if (mounted) {
          setData(json);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = localStorage.getItem('auth_token');

      if (!token) return;

      try {
        const response = await fetch(
          `${API_URL}/api/me/race-stats`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json?.error || 'Stats course indisponibles'
          );
        }

        if (!mounted) return;

        setRaceBestScore(json.best_score ?? 0);
        setRaceBestToday(json.best_today ?? 0);
        setRaceRunsCount(json.runs_count ?? 0);
      } catch (error) {
        console.error(error);

        if (mounted) {
          setRaceBestScore(null);
          setRaceBestToday(null);
          setRaceRunsCount(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const rate =
    data?.total_players > 0
      ? Math.round(
          (data.solvers / data.total_players) * 100
        )
      : 0;

  const dist = data?.distribution || {};

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--card-border)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Stats du jour
        </h3>
      </div>

      <div style={{ padding: 18 }}>
        {loading && !data ? (
          <div
            style={{
              color: 'var(--muted)',
              fontSize: 14,
            }}
          >
            Chargement...
          </div>
        ) : (
          <>
            {data && (
              <>
                <div
                  className="stat-grid"
                  style={{ marginBottom: 16 }}
                >
                  <div className="stat-card">
                    <div className="stat-value">
                      {data.total_players}
                    </div>
                    <div className="stat-label">
                      Joueurs
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-value">
                      {data.solvers}
                    </div>
                    <div className="stat-label">
                      Résolus ({rate}%)
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-value">
                      {Number(
                        data.avg_attempts || 0
                      ).toFixed(1)}
                    </div>
                    <div className="stat-label">
                      Moy. essais
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 8,
                    }}
                  >
                    Distribution
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    {Array.from({ length: 6 }).map(
                      (_, i) => {
                        const k = String(i + 1);
                        const v = dist[k] || 0;

                        return (
                          <span
                            key={k}
                            className="lb-pill"
                          >
                            {k}: {v}
                          </span>
                        );
                      }
                    )}

                    <span className="lb-pill">
                      &gt;6: {dist['>6'] || 0}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 8,
                }}
              >
                Mode Course
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span className="lb-pill">
                  Meilleur:{' '}
                  {raceBestScore == null
                    ? '—'
                    : raceBestScore}
                </span>

                <span className="lb-pill">
                  Aujourd'hui:{' '}
                  {raceBestToday == null
                    ? '—'
                    : raceBestToday}
                </span>

                <span className="lb-pill">
                  Runs:{' '}
                  {raceRunsCount == null
                    ? '—'
                    : raceRunsCount}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
