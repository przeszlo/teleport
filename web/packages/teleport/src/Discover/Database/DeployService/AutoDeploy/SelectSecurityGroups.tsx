/**
 * Teleport
 * Copyright (C) 2023  Gravitational, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import React, { useState, useEffect } from 'react';

import { Text, Flex, Box, Indicator } from 'design';
import * as Icons from 'design/Icon';
import { FetchStatus } from 'design/DataTable/types';

import useAttempt from 'shared/hooks/useAttemptNext';
import { getErrMessage } from 'shared/utils/errorType';

import {
  integrationService,
  SecurityGroup,
} from 'teleport/services/integrations';
import { DbMeta } from 'teleport/Discover/useDiscover';

import { SecurityGroupPicker, ButtonBlueText } from '../../../Shared';

type TableData = {
  items: SecurityGroup[];
  nextToken?: string;
  fetchStatus: FetchStatus;
};

export const SelectSecurityGroups = ({
  selectedSecurityGroups,
  setSelectedSecurityGroups,
  dbMeta,
  emitErrorEvent,
}: {
  selectedSecurityGroups: string[];
  setSelectedSecurityGroups: React.Dispatch<React.SetStateAction<string[]>>;
  dbMeta: DbMeta;
  emitErrorEvent(err: string): void;
}) => {
  const [sgTableData, setSgTableData] = useState<TableData>({
    items: [],
    nextToken: '',
    fetchStatus: 'disabled',
  });

  const { attempt, run } = useAttempt('processing');

  function onSelectSecurityGroup(
    sg: SecurityGroup,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    if (e.target.checked) {
      return setSelectedSecurityGroups(currentSelectedGroups => [
        ...currentSelectedGroups,
        sg.id,
      ]);
    } else {
      setSelectedSecurityGroups(
        selectedSecurityGroups.filter(id => id !== sg.id)
      );
    }
  }

  async function fetchSecurityGroups() {
    const integration = dbMeta.integration;
    const selectedDb = dbMeta.selectedAwsRdsDb;

    run(() =>
      integrationService
        .fetchSecurityGroups(integration.name, {
          vpcId: selectedDb.vpcId,
          region: selectedDb.region,
          nextToken: sgTableData.nextToken,
        })
        .then(({ securityGroups, nextToken }) => {
          setSgTableData({
            nextToken: nextToken,
            fetchStatus: nextToken ? '' : 'disabled',
            items: [...sgTableData.items, ...securityGroups],
          });
        })
        .catch((err: Error) => {
          const errMsg = getErrMessage(err);
          emitErrorEvent(`fetch security groups error: ${errMsg}`);
          throw err;
        })
    );
  }

  useEffect(() => {
    fetchSecurityGroups();
  }, []);

  return (
    <>
      <Text bold>Step 3 (Optional)</Text>
      <Text bold>Select Security Groups</Text>
      <Text mb={2}>
        Select security groups to assign to the Fargate service that will be
        running the database access agent. The security groups you pick must
        allow outbound connectivity to this Teleport cluster. If you don't
        select any security groups, the default one for the VPC will be used.
      </Text>
      {attempt.status === 'failed' && (
        <>
          <Flex my={3}>
            <Icons.Warning size="medium" ml={1} mr={2} color="error.main" />
            <Text>{attempt.statusText}</Text>
          </Flex>
          <ButtonBlueText ml={1} onClick={fetchSecurityGroups}>
            Retry
          </ButtonBlueText>
        </>
      )}
      {attempt.status === 'processing' && (
        <Flex width="904px" justifyContent="center" mt={3}>
          <Indicator />
        </Flex>
      )}
      {attempt.status === 'success' && (
        <Box mt={3}>
          <SecurityGroupPicker
            items={sgTableData.items}
            attempt={attempt}
            fetchNextPage={fetchSecurityGroups}
            fetchStatus={sgTableData.fetchStatus}
            onSelectSecurityGroup={onSelectSecurityGroup}
            selectedSecurityGroups={selectedSecurityGroups}
          />
        </Box>
      )}
    </>
  );
};
