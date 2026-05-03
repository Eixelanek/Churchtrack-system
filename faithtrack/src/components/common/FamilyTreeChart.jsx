import React from 'react';
import './FamilyTreeChart.css';

function ParentsBridge({ count }) {
  if (count <= 1) {
    return (
      <div className="ft-bridge ft-bridge--single" aria-hidden="true">
        <div className="ft-bridge__stem" />
      </div>
    );
  }
  return (
    <div className="ft-bridge ft-bridge--pair" aria-hidden="true">
      <svg className="ft-bridge__svg" viewBox="0 0 240 36" preserveAspectRatio="none">
        <path
          className="ft-bridge__path"
          d="M 52 0 L 52 14 L 188 14 L 188 0"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line className="ft-bridge__path" x1="120" y1="14" x2="120" y2="36" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function VerticalStem({ tall }) {
  return (
    <div className={tall ? 'ft-stem ft-stem--tall' : 'ft-stem'} aria-hidden="true">
      <div className="ft-stem__line" />
    </div>
  );
}

function TreeCard({ person, getInitials, formatRelation, highlight, theme }) {
  const pic = person.profile_picture || person.photoUrl || person.photo;
  const meta = person.birth_year || person.birthday;

  return (
    <div className={`ft-card ft-card--${theme} ${highlight ? 'ft-card--focus' : ''}`}>
      <div className="ft-card__avatar">
        {pic ? (
          <img src={pic} alt="" className="ft-card__img" />
        ) : (
          <span>{getInitials(person.name)}</span>
        )}
      </div>
      <div className="ft-card__body">
        <span className="ft-card__name">{person.name}</span>
        {meta ? <span className="ft-card__meta">{String(meta)}</span> : null}
      </div>
    </div>
  );
}

/**
 * Pedigree-style layout: parents → your generation (siblings + household) → children.
 */
export default function FamilyTreeChart({
  parents = [],
  centerRow = [],
  siblings = [],
  children = [],
  other = [],
  getInitials,
  formatRelation = (r) => r || '',
  highlightRelation = 'You',
  theme = 'green',
}) {
  const hasParents = parents.length > 0;
  const hasMid = centerRow.length > 0 || siblings.length > 0;
  const hasChildren = children.length > 0;
  const hasOther = other.length > 0;

  const isFocus = (person) =>
    person &&
    (person.relation === highlightRelation ||
      (highlightRelation === 'Member' && person.relation === 'Member'));

  if (!hasParents && !hasMid && !hasChildren && !hasOther) {
    return null;
  }

  return (
    <div className={`ft-chart ft-chart--${theme}`}>
      {hasParents && (
        <>
          <section className="ft-tier">
            <h4 className="ft-tier-title">Parents</h4>
            <div className="ft-tier-row ft-tier-row--parents">
              {parents.map((p) => (
                <TreeCard
                  key={p.id ?? `${p.name}-${p.relation}`}
                  person={p}
                  getInitials={getInitials}
                  formatRelation={formatRelation}
                  highlight={false}
                  theme={theme}
                />
              ))}
            </div>
          </section>
          <ParentsBridge count={parents.length} />
        </>
      )}

      {hasMid && (
        <>
          {hasParents && <VerticalStem />}
          <section className="ft-tier">
            <h4 className="ft-tier-title">Your generation</h4>
            <div className={`ft-mid ${siblings.length ? 'ft-mid--with-sibs' : ''}`}>
              {siblings.length > 0 && (
                <div className="ft-mid-sibs">
                  <span className="ft-cluster-caption">Siblings</span>
                  <div className="ft-cluster-row">
                    {siblings.map((p) => (
                      <TreeCard
                        key={p.id ?? `${p.name}-${p.relation}`}
                        person={p}
                        getInitials={getInitials}
                        formatRelation={formatRelation}
                        highlight={false}
                        theme={theme}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="ft-mid-home">
                <div className="ft-household">
                  {centerRow.map((p, idx) => (
                    <React.Fragment key={p.id ?? `${p.name}-${p.relation}-${idx}`}>
                      {idx > 0 ? (
                        <span className="ft-marriage" aria-hidden="true" title="Partners">
                          <span className="ft-marriage__ring" />
                        </span>
                      ) : null}
                      <TreeCard
                        person={p}
                        getInitials={getInitials}
                        formatRelation={formatRelation}
                        highlight={isFocus(p)}
                        theme={theme}
                      />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {hasChildren && (
        <>
          {(hasParents || hasMid) && <VerticalStem tall />}
          <section className="ft-tier">
            <h4 className="ft-tier-title">Children</h4>
            <div className="ft-tier-row ft-tier-row--children">
              {children.map((p) => (
                <TreeCard
                  key={p.id ?? `${p.name}-${p.relation}`}
                  person={p}
                  getInitials={getInitials}
                  formatRelation={formatRelation}
                  highlight={false}
                  theme={theme}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {hasOther && (
        <section className="ft-tier ft-tier--other">
          <h4 className="ft-tier-title">Other family</h4>
          <div className="ft-tier-row ft-tier-row--other">
            {other.map((p) => (
              <TreeCard
                key={p.id ?? `${p.name}-${p.relation}`}
                person={p}
                getInitials={getInitials}
                formatRelation={formatRelation}
                highlight={false}
                theme={theme}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
